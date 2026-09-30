import { czechNbsp, type Locale } from './index';

/**
 * Interface text for every language. Content that editors change (bio,
 * quotes, milestones, photos, shows) lives in src/data and the CMS instead.
 */
const en = {
    meta: {
        title: 'Ian Kita | Techno & Tech House DJ — Zlín, CZ',
        description:
            'Ian Kita — techno & tech house DJ and producer from Zlín, Czech Republic. Upcoming shows, latest releases, photos and booking.',
    },
    skipLink: 'Skip to content',
    quotes: { open: '“', close: '”' },
    nav: {
        home: 'Ian Kita — home',
        primary: 'Primary',
        mobile: 'Mobile',
        about: 'About',
        journey: 'Journey',
        shows: 'Shows',
        music: 'Music',
        gallery: 'Gallery',
        book: 'Book',
        menu: 'Menu',
        close: 'Close',
    },
    about: {
        label: 'About',
        photoAlt: 'Ian Kita mixing on Pioneer decks in the sun at Mácháč 2026',
    },
    journey: {
        label: 'Journey',
        heading: 'From vinyl roots to festival main stages.',
    },
    live: {
        label: 'Live',
    },
    shows: {
        label: 'Shows',
        heading: 'Where to hear him next',
        next: 'Next',
        photoAlt: 'Ian Kita playing above the lake at Mácháč 2026',
        emptyBefore: 'No upcoming shows right now — check back soon or ',
        emptyLink: 'book a date',
        emptyAfter: '.',
    },
    music: {
        label: 'Music',
        heading: 'Latest releases & sets',
        emptyBefore: 'Fresh releases are on ',
        emptyLink: 'SoundCloud',
        emptyAfter: '.',
        platformLabel: (platform: string) => `Ian Kita on ${platform}`,
        listenLabel: (title: string) => `Listen to ${title} on SoundCloud`,
    },
    gallery: {
        label: 'Gallery',
        heading: 'Nights & stages',
        viewer: 'Photo viewer',
        close: 'Close',
        previous: 'Previous photo',
        next: 'Next photo',
        openPhoto: (caption: string) => `Open photo: ${caption}`,
    },
    booking: {
        label: 'Booking',
        heading: 'Available for clubs, festivals and radio shows across Europe.',
        description:
            'Techno and tech house sets, radio show guest mixes and remixes. Based in Zlín, Czech Republic — playing across the Czech Republic, Slovakia, Poland, Germany and Luxembourg.',
        rights: 'Ian Kita. All rights reserved.',
        privacy: 'Privacy Policy',
        terms: 'Terms of Service',
        madeBy: 'Made by',
        madeByLabel: "Karel Braborec's website",
    },
    legal: {
        back: 'Back to Home',
        updated: 'Last updated:',
    },
};

export type Dictionary = typeof en;

const cs: Dictionary = {
    meta: {
        title: 'Ian Kita | Techno a tech house DJ – Zlín',
        description:
            'Ian Kita – techno a tech house DJ a producent ze Zlína. Nadcházející akce, nejnovější tracky, fotky a booking.',
    },
    skipLink: 'Přeskočit na obsah',
    quotes: { open: '„', close: '“' },
    nav: {
        home: 'Ian Kita – úvod',
        primary: 'Hlavní navigace',
        mobile: 'Mobilní navigace',
        about: 'Bio',
        journey: 'Cesta',
        shows: 'Akce',
        music: 'Hudba',
        gallery: 'Galerie',
        book: 'Booking',
        menu: 'Menu',
        close: 'Zavřít',
    },
    about: {
        label: 'Bio',
        photoAlt: 'Ian Kita za pulty Pioneer na slunném Mácháči 2026',
    },
    journey: {
        label: 'Cesta',
        heading: 'Od vinylových začátků po hlavní festivalová pódia.',
    },
    live: {
        label: 'Živě',
    },
    shows: {
        label: 'Akce',
        heading: 'Kde ho uslyšíte příště',
        next: 'Nejbližší',
        photoAlt: 'Ian Kita hraje nad jezerem na Mácháči 2026',
        emptyBefore: 'Momentálně nejsou naplánované žádné akce – zastavte se brzy znovu, nebo si ',
        emptyLink: 'domluvte termín',
        emptyAfter: '.',
    },
    music: {
        label: 'Hudba',
        heading: 'Nejnovější vydání a sety',
        emptyBefore: 'Nové tracky najdete na ',
        emptyLink: 'SoundCloudu',
        emptyAfter: '.',
        platformLabel: (platform) => `Ian Kita na platformě ${platform}`,
        listenLabel: (title) => `Poslechnout si ${title} na SoundCloudu`,
    },
    gallery: {
        label: 'Galerie',
        heading: 'Noci a pódia',
        viewer: 'Prohlížeč fotek',
        close: 'Zavřít',
        previous: 'Předchozí fotka',
        next: 'Další fotka',
        openPhoto: (caption) => `Otevřít fotku: ${caption}`,
    },
    booking: {
        label: 'Booking',
        heading: 'K dispozici pro kluby, festivaly i rádia po celé Evropě.',
        description:
            'Techno a tech house sety, hostovské mixy do rádií a remixy. Sídlí ve Zlíně a hraje po celé České republice, na Slovensku, v Polsku, Německu a Lucembursku.',
        rights: 'Ian Kita. Všechna práva vyhrazena.',
        privacy: 'Ochrana osobních údajů',
        terms: 'Podmínky užití',
        madeBy: 'Web vytvořil',
        madeByLabel: 'Karel Braborec, autor webu',
    },
    legal: {
        back: 'Zpět na úvod',
        updated: 'Naposledy aktualizováno:',
    },
};

/** Applies Czech typesetting (see czechNbsp) to every string in a dictionary. */
function typesetStrings<T>(value: T): T {
    if (typeof value === 'string') return czechNbsp(value) as T;
    if (value === null || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, typesetStrings(entry)])) as T;
}

const dictionaries: Record<Locale, Dictionary> = { en, cs: typesetStrings(cs) };

export function getDictionary(locale: Locale): Dictionary {
    return dictionaries[locale];
}
