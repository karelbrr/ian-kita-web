// The Worker behind iankita.com. Pages are static files from dist/ (served
// before this code runs); the Worker only adds two scheduled jobs and a
// protected way to try the monthly report.
import {buildReport, renderEmail} from './report.js';

const NIGHTLY_REBUILD = '15 0 * * *';
const MONTHLY_REPORT = '0 6 1 * *';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === '/__report' && request.method === 'POST') return reportRequest(request, env, url);
        return env.ASSETS.fetch(request);
    },

    async scheduled(event, env, ctx) {
        if (event.cron === MONTHLY_REPORT) ctx.waitUntil(sendReport(env));
        if (event.cron === NIGHTLY_REBUILD) ctx.waitUntil(rebuild(env));
    },
};

// Rebuilding refreshes the upcoming shows (past dates drop out) and the
// SoundCloud tracks, which are both read at build time.
async function rebuild(env) {
    if (!env.DEPLOY_HOOK_URL) {
        console.warn('rebuild: DEPLOY_HOOK_URL is not set, skipping.');
        return;
    }
    const response = await fetch(env.DEPLOY_HOOK_URL, {method: 'POST'});
    if (!response.ok) console.error(`rebuild: deploy hook answered ${response.status}.`);
}

async function sendReport(env) {
    const email = renderEmail(await buildReport(env), env.CF_ACCOUNT_ID);
    const recipients = (env.REPORT_TO ?? '').split(',').map((address) => address.trim()).filter(Boolean);
    if (recipients.length === 0) throw new Error('REPORT_TO is not set.');
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({from: env.REPORT_FROM, to: recipients, subject: email.subject, html: email.html, text: email.text}),
    });
    if (!response.ok) throw new Error(`Resend answered ${response.status}: ${await response.text()}`);
    return email;
}

// POST /__report with "Authorization: Bearer <REPORT_KEY>" shows last month's
// report without sending it; add ?send=1 to e-mail it as well. Anyone else
// gets the ordinary 404 page.
async function reportRequest(request, env, url) {
    if (!env.REPORT_KEY || request.headers.get('Authorization') !== `Bearer ${env.REPORT_KEY}`) {
        return env.ASSETS.fetch(new Request(url));
    }
    try {
        const email = url.searchParams.get('send') === '1'
            ? await sendReport(env)
            : renderEmail(await buildReport(env), env.CF_ACCOUNT_ID);
        return new Response(email.html, {headers: {'Content-Type': 'text/html; charset=utf-8'}});
    } catch (error) {
        return new Response(`Report failed: ${error.message}`, {status: 500});
    }
}
