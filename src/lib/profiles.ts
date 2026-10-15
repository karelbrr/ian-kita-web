import type {Locale} from '../i18n';

// Ian's profiles on other sites. The site links to them, and the structured
// data in Layout.astro lists them (sameAs), so search engines connect them to
// iankita.com.
export const PROFILES = {
    instagram: {href: 'https://www.instagram.com/dj_ian_kita/', label: 'Instagram'},
    facebook: {href: 'https://www.facebook.com/iankitadj', label: 'Facebook'},
    soundcloud: {href: 'https://soundcloud.com/iankitadj', label: 'SoundCloud'},
    spotify: {href: 'https://open.spotify.com/artist/5O53OdbKPbycjdfysY4Oyt', label: 'Spotify'},
    beatport: {href: 'https://www.beatport.com/artist/ian-kita/210449', label: 'Beatport'},
};

// GoOut lists his shows with tickets, in the visitor's language.
export const GOOUT_URL: Record<Locale, string> = {
    en: 'https://goout.net/en/ian-kita/pzvlrng/',
    cs: 'https://goout.net/cs/ian-kita/pzvlrng/',
};
