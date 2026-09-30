// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://iankita.com',
  // English lives at the site root, Czech under /cs/ (src/pages/cs).
  i18n: {
    locales: ['en', 'cs'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    // Links each page to its other-language version in the sitemap.
    sitemap({ i18n: { defaultLocale: 'en', locales: { en: 'en', cs: 'cs' } } }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
