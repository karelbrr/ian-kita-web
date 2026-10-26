// Monthly visitor report for iankita.com. Reads Cloudflare Web Analytics
// (GraphQL API) for the previous calendar month and renders a short Czech
// e-mail. Each section is a separate query, so one failing breakdown still
// leaves the rest of the report.

const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';
const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];

const PAGE_NAMES = {
    '/': 'Úvod (EN)',
    '/cs/': 'Úvod (CZ)',
    '/privacy-policy/': 'Ochrana osobních údajů (EN)',
    '/cs/privacy-policy/': 'Ochrana osobních údajů (CZ)',
    '/terms/': 'Podmínky užití (EN)',
    '/cs/terms/': 'Podmínky užití (CZ)',
};

const REFERRERS = [
    [/(^|\.)google\./, 'Google'],
    [/(^|\.)seznam\.cz$/, 'Seznam'],
    [/(^|\.)bing\.com$/, 'Bing'],
    [/(^|\.)instagram\.com$/, 'Instagram'],
    [/(^|\.)(facebook\.com|fb\.me)$/, 'Facebook'],
    [/(^|\.)soundcloud\.com$/, 'SoundCloud'],
    [/(^|\.)spotify\.com$/, 'Spotify'],
    [/(^|\.)goout\.net$/, 'GoOut'],
    [/(^|\.)beatport\.com$/, 'Beatport'],
];

const DEVICES = {desktop: 'Počítač', mobile: 'Mobil', tablet: 'Tablet'};

/** The calendar month before `now`, in UTC. */
export function previousMonth(now = new Date()) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return {start, end, label: `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`};
}

// GraphQL literal for a plain object (keys as names, values as JSON).
function literal(value) {
    if (Array.isArray(value)) return `[${value.map(literal).join(', ')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.entries(value).map(([key, inner]) => `${key}: ${literal(inner)}`).join(', ')}}`;
    }
    return JSON.stringify(value);
}

async function rumGroups(env, period, {fields, limit = 1, orderBy}) {
    const filter = literal({
        AND: [
            {siteTag: env.WA_SITE_TAG},
            {datetime_geq: period.start.toISOString(), datetime_lt: period.end.toISOString()},
            {bot: 0},
        ],
    });
    const order = orderBy ? `, orderBy: [${orderBy}]` : '';
    const query = `{ viewer { accounts(filter: {accountTag: ${JSON.stringify(env.CF_ACCOUNT_ID)}}) {
        rumPageloadEventsAdaptiveGroups(limit: ${limit}, filter: ${filter}${order}) { ${fields} }
    } } }`;
    const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({query}),
    });
    const body = await response.json();
    if (!response.ok || body.errors?.length) {
        throw new Error(body.errors?.map((error) => error.message).join('; ') || `HTTP ${response.status}`);
    }
    return body.data.viewer.accounts[0]?.rumPageloadEventsAdaptiveGroups ?? [];
}

async function totals(env, period) {
    const [row] = await rumGroups(env, period, {fields: 'count sum { visits }'});
    return {pageViews: row?.count ?? 0, visits: row?.sum?.visits ?? 0};
}

async function breakdown(env, period, dimension, {limit, orderBy}) {
    const rows = await rumGroups(env, period, {fields: `count sum { visits } dimensions { ${dimension} }`, limit, orderBy});
    return rows.map((row) => ({key: row.dimensions[dimension] ?? '', pageViews: row.count, visits: row.sum?.visits ?? 0}));
}

// Runs a section's query and keeps its error instead of failing the report.
async function section(run) {
    try {
        return {rows: await run()};
    } catch (error) {
        return {rows: [], error: error.message};
    }
}

export async function buildReport(env, now = new Date()) {
    const current = previousMonth(now);
    const before = previousMonth(current.start);
    const [thisMonth, lastMonth, pages, referrers, countries, devices] = await Promise.all([
        totals(env, current),
        totals(env, before).catch(() => null),
        section(() => breakdown(env, current, 'requestPath', {limit: 50, orderBy: 'count_DESC'})),
        section(() => breakdown(env, current, 'refererHost', {limit: 20, orderBy: 'sum_visits_DESC'})),
        section(() => breakdown(env, current, 'countryName', {limit: 5, orderBy: 'sum_visits_DESC'})),
        section(() => breakdown(env, current, 'deviceType', {limit: 5, orderBy: 'sum_visits_DESC'})),
    ]);
    return {period: current, thisMonth, lastMonth, pages, referrers, countries, devices};
}

// --- Rendering ------------------------------------------------------------------

const number = new Intl.NumberFormat('cs-CZ');
const regionNames = new Intl.DisplayNames(['cs'], {type: 'region'});

// "1 návštěva", "3 návštěvy", "7 návštěv"; "zobrazení" never changes.
const UNITS = {visits: ['návštěva', 'návštěvy', 'návštěv'], pageViews: ['zobrazení', 'zobrazení', 'zobrazení']};
function counted(value, unit) {
    const [one, few, many] = UNITS[unit];
    return `${number.format(value)} ${value === 1 ? one : value >= 2 && value <= 4 ? few : many}`;
}

// Cloudflare may report a country as an ISO code or as an English name.
const ENGLISH_COUNTRIES = {Czechia: 'CZ', 'Czech Republic': 'CZ', Slovakia: 'SK', Germany: 'DE', Poland: 'PL', Austria: 'AT', Hungary: 'HU', 'United Kingdom': 'GB', 'United States': 'US', Netherlands: 'NL', Luxembourg: 'LU'};
function countryName(value) {
    const code = /^[A-Z]{2}$/.test(value) ? value : ENGLISH_COUNTRIES[value];
    if (!code) return value || 'Neznámá';
    try {
        return regionNames.of(code) ?? value;
    } catch {
        return value;
    }
}
const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);

function change(current, previous) {
    if (previous === undefined || previous === null) return '';
    if (previous === 0) return current > 0 ? 'první měsíc s daty' : '';
    const percent = Math.round(((current - previous) / previous) * 100);
    if (percent === 0) return 'stejně jako minulý měsíc';
    return `${percent > 0 ? '+' : '−'}${Math.abs(percent)} % oproti minulému měsíci`;
}

function share(part, whole) {
    return whole > 0 ? `${Math.round((part / whole) * 100)} %` : '—';
}

function referrerName(host) {
    if (!host) return 'Přímo (záložka, napsaná adresa, aplikace)';
    return REFERRERS.find(([pattern]) => pattern.test(host))?.[1] ?? host.replace(/^www\./, '');
}

// Shapes the raw rows into the lines each section shows.
export function summarize(report) {
    const {thisMonth, lastMonth, pages, referrers, countries, devices} = report;
    const czechViews = pages.rows.filter((row) => row.key.startsWith('/cs/')).reduce((sum, row) => sum + row.pageViews, 0);
    const pageViewsInPages = pages.rows.reduce((sum, row) => sum + row.pageViews, 0);

    const merged = new Map();
    for (const row of referrers.rows) {
        if (/(^|\.)iankita\.com$/.test(row.key)) continue;
        const name = referrerName(row.key);
        merged.set(name, (merged.get(name) ?? 0) + row.visits);
    }

    return {
        label: report.period.label,
        visits: {value: thisMonth.visits, note: change(thisMonth.visits, lastMonth?.visits)},
        pageViews: {value: thisMonth.pageViews, note: change(thisMonth.pageViews, lastMonth?.pageViews)},
        czechShare: share(czechViews, pageViewsInPages),
        sections: [
            {
                title: 'Nejčtenější stránky',
                unit: 'pageViews',
                error: pages.error,
                lines: pages.rows.slice(0, 6).map((row) => [PAGE_NAMES[row.key] ?? row.key, row.pageViews]),
            },
            {
                title: 'Odkud lidé přišli',
                unit: 'visits',
                error: referrers.error,
                lines: [...merged].sort((a, b) => b[1] - a[1]).slice(0, 6),
            },
            {
                title: 'Země',
                unit: 'visits',
                error: countries.error,
                lines: countries.rows.map((row) => [countryName(row.key), row.visits]),
            },
            {
                title: 'Zařízení',
                unit: 'visits',
                error: devices.error,
                lines: devices.rows.map((row) => [DEVICES[row.key] ?? (row.key || 'Neznámé'), row.visits]),
            },
        ],
    };
}

export function renderEmail(report, accountId) {
    const s = summarize(report);
    const dashboard = `https://dash.cloudflare.com/${accountId}/web-analytics`;
    const subject = `iankita.com – přehled návštěvnosti za ${s.label}`;

    const tile = (label, value, note) => `
        <td style="padding:14px 16px;border:1px solid #e6e6e6;width:33%;vertical-align:top">
          <div style="font-size:12px;color:#666">${label}</div>
          <div style="font-size:26px;font-weight:700;color:#111;margin-top:4px">${value}</div>
          <div style="font-size:12px;color:#666;margin-top:4px">${escape(note || ' ')}</div>
        </td>`;

    const sectionHtml = (sec) => `
        <h2 style="font-size:15px;color:#111;margin:26px 0 8px">${sec.title}</h2>
        ${sec.error ? `<p style="font-size:13px;color:#b00">Tuto část se nepodařilo načíst.</p>`
            : sec.lines.length === 0 ? `<p style="font-size:13px;color:#666">Za tento měsíc bez dat.</p>`
            : `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px">
                ${sec.lines.map(([name, value]) => `<tr>
                  <td style="padding:6px 0;border-bottom:1px solid #eee;color:#222">${escape(name)}</td>
                  <td style="padding:6px 0;border-bottom:1px solid #eee;color:#222;text-align:right;white-space:nowrap">${counted(value, sec.unit)}</td>
                </tr>`).join('')}
              </table>`}`;

    const html = `<!doctype html><html lang="cs"><body style="margin:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#fff">
          <tr><td style="height:4px;background:#F2880F;background-image:linear-gradient(90deg,#F2880F,#D6306A,#5E2A6E)"></td></tr>
          <tr><td style="padding:24px 24px 8px">
            <div style="font-size:12px;color:#666;letter-spacing:.08em;text-transform:uppercase">Ian Kita · iankita.com</div>
            <h1 style="font-size:22px;color:#111;margin:6px 0 0">Návštěvnost za ${escape(s.label)}</h1>
          </td></tr>
          <tr><td style="padding:16px 24px 0">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr>
              ${tile('Návštěvy', number.format(s.visits.value), s.visits.note)}
              ${tile('Zobrazení stránek', number.format(s.pageViews.value), s.pageViews.note)}
              ${tile('Česká verze', s.czechShare, 'podíl zobrazení')}
            </tr></table>
          </td></tr>
          <tr><td style="padding:0 24px 8px">${s.sections.map(sectionHtml).join('')}</td></tr>
          <tr><td style="padding:20px 24px 24px;font-size:12px;color:#888;border-top:1px solid #eee">
            Data: Cloudflare Web Analytics, bez cookies, roboti nejsou započítaní.
            Podrobnosti najdete v <a href="${dashboard}" style="color:#B5500A">přehledu na Cloudflaru</a>.
          </td></tr>
        </table>
      </td></tr></table>
    </body></html>`;

    const text = [
        `Návštěvnost iankita.com za ${s.label}`,
        '',
        `Návštěvy: ${number.format(s.visits.value)} ${s.visits.note ? `(${s.visits.note})` : ''}`,
        `Zobrazení stránek: ${number.format(s.pageViews.value)} ${s.pageViews.note ? `(${s.pageViews.note})` : ''}`,
        `Česká verze: ${s.czechShare} zobrazení`,
        ...s.sections.flatMap((sec) => ['', `${sec.title}:`, ...(sec.error ? ['(nepodařilo se načíst)'] : sec.lines.map(([name, value]) => `- ${name}: ${counted(value, sec.unit)}`))]),
        '',
        `Podrobnosti: ${dashboard}`,
    ].join('\n');

    return {subject, html, text};
}
