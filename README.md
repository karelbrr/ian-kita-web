# Ian Kita Web Portfolio

A photo-led portfolio website for electronic music artist Ian Kita (Techno & Tech House DJ, Zlín, CZ): live shows, latest releases, gallery and booking, built around the logotype from his press pack.

## Tech Stack
- **Framework**: [Astro](https://astro.build)
- **Styling**: [Tailwind CSS](https://tailwindcss.com) v4
- **Integrations**: [`@astrojs/sitemap`](https://docs.astro.build/en/guides/integrations-guide/sitemap/)
- **Images**: press-pack photos live in `src/assets/photos/` and go through `astro:assets` (responsive WebP); the logotype is inline SVG rendered from `src/lib/logo.ts`
- **Content**: editable JSON in `src/data/` (Decap CMS at `/admin/`)
- **Data sources**: live SoundCloud tracks (via `soundcloud.ts`), fetched at build time and cached to disk

## Project Structure

```text
/
├── public/                  # Favicons, og-image, manifest, admin/ (CMS config), video/ (live loop)
├── scripts/
│   └── generate-brand-assets.mjs  # Rebuilds favicon, app icons and og-image from the logo + portrait
├── src/
│   ├── assets/
│   │   ├── logo.svg          # Official logotype (vector, extracted from the press-pack PDF)
│   │   └── photos/           # Press photos (also the CMS media folder)
│   ├── components/           # Nav, Hero, About, Marquee, Journey, LiveBand,
│   │                         # UpcomingShows, LatestTracks, Gallery, Booking, Logo
│   ├── data/                 # about, milestones, festivals, upcoming-shows, gallery (CMS-edited JSON)
│   ├── layouts/              # Layout.astro — <head>, SEO/OG/Twitter meta, JSON-LD, nav, grain
│   ├── lib/
│   │   ├── logo.ts              # Logotype glyph paths for inline rendering
│   │   ├── photos.ts            # Resolves CMS photo paths to optimisable imports
│   │   ├── soundcloudTracks.ts  # Fetches + caches latest SoundCloud tracks
│   │   └── spotifyLinks.ts      # Manual SoundCloud → Spotify track link mapping
│   ├── pages/                # index, 404, privacy-policy, terms, admin
│   ├── scripts/main.ts       # Client behaviour: reveals, nav, lightbox, lazy video
│   └── styles/               # Global CSS (Tailwind theme, motion, components)
└── package.json
```

## Content

All editable content is JSON in `src/data/`, managed through Decap CMS at `/admin/` (config in `public/admin/config.yml`):

- `about.json` — hero tagline/eyebrow, about text, manifesto quotes, key numbers, record labels (marquee band)
- `upcoming-shows.json` — shows (past dates are filtered out automatically)
- `milestones.json`, `festivals.json` (names for the marquee band), `gallery.json` (photo, alt text, caption)

Photos uploaded through the CMS land in `src/assets/photos/` and are referenced as `/src/assets/photos/<file>`, so they get optimised like any imported image. The gallery layout is derived from each photo's orientation (portrait → two rows, wide → two columns, first wide photo → 2×2 tile).

The logotype comes from the press pack: `src/assets/logo.svg` is the vector file, `src/lib/logo.ts` holds the same paths per letter for inline rendering and the hero draw-on animation. Run `node scripts/generate-brand-assets.mjs` to regenerate the favicon, app icons and Open Graph image.

SoundCloud tracks are fetched live and cached in `.cache/tracks.json` for a day to keep local dev and builds fast. To link a SoundCloud track to its Spotify release, add an entry to `src/lib/spotifyLinks.ts` keyed by the track's SoundCloud permalink URL.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying      |

For agent-driven development, start the dev server in background mode instead: `astro dev --background` (manage with `astro dev stop` / `status` / `logs`).
