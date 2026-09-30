import aboutEn from '../data/about.json';
import aboutCs from '../data/about.cs.json';
import { czechNbsp, type Locale } from './index';

/** The About texts (hero lines, bio and quotes) in a language. Both files are edited in the CMS. */
export function getAbout(locale: Locale) {
    if (locale !== 'cs') return aboutEn;
    return {
        ...aboutCs,
        lead: czechNbsp(aboutCs.lead),
        paragraphs: aboutCs.paragraphs.map(czechNbsp),
        quote: czechNbsp(aboutCs.quote),
        liveQuote: czechNbsp(aboutCs.liveQuote),
    };
}
