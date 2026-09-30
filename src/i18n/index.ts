/**
 * Languages of the site. English lives at the site root and Czech under /cs/,
 * mirroring src/pages and src/pages/cs (see i18n in astro.config.mjs).
 */
export const LOCALES = ['en', 'cs'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** How each language is labelled in the language switch and in <head>. */
export const LANGUAGES: Record<Locale, { code: string; name: string; hreflang: string; ogLocale: string }> = {
    en: { code: 'EN', name: 'English', hreflang: 'en', ogLocale: 'en_US' },
    cs: { code: 'CZ', name: 'Čeština', hreflang: 'cs', ogLocale: 'cs_CZ' },
};

export function toLocale(value: string | undefined): Locale {
    return LOCALES.find((locale) => locale === value) ?? DEFAULT_LOCALE;
}

export function otherLocale(locale: Locale): Locale {
    return locale === 'en' ? 'cs' : 'en';
}

/** A site path in the given language: "/#about" stays as is in English and becomes "/cs/#about" in Czech. */
export function localePath(locale: Locale, path: string): string {
    if (locale === DEFAULT_LOCALE) return path;
    return `/${locale}${path.startsWith('/') ? path : `/${path}`}`;
}

const LOCALE_PREFIX = new RegExp(`^/(${LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).join('|')})(?=/|$)`);

/** The current page in another language, e.g. "/cs/terms/" and "/terms/". */
export function translatedPath(pathname: string, locale: Locale): string {
    return localePath(locale, pathname.replace(LOCALE_PREFIX, '') || '/');
}

/**
 * Czech typesetting rule: a one-letter preposition or conjunction (a, i, k, o,
 * s, u, v, z) must not end a line, so it is joined to the next word with a
 * no-break space.
 */
export function czechNbsp(text: string): string {
    return text.replace(/(?<=^|[\s(„])([aikosuvzAIKOSUVZ]) /g, '$1 ');
}

/** czechNbsp for an HTML string: only the text between tags changes. */
export function czechNbspHtml(html: string): string {
    return html
        .split(/(<[^>]*>)/)
        .map((part) => (part.startsWith('<') ? part : czechNbsp(part)))
        .join('');
}

/**
 * For content that stores its Czech translation in an optional field (for
 * example `text` and `text_cs`): the Czech text on Czech pages when one is
 * filled in, the English text otherwise.
 */
export function pick(locale: Locale, english: string, czech?: string): string {
    return locale === 'cs' && czech ? czechNbsp(czech) : english;
}
