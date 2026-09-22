# Ian Kita Web Portfolio

A minimal, modern portfolio website showcasing selected works and upcoming performances by electronic music artist Ian Kita (Techno & Tech House DJ, Zlín, CZ).

## Tech Stack
- **Framework**: [Astro](https://astro.build)
- **Styling**: [Tailwind CSS](https://tailwindcss.com) v4
- **Integrations**: [`@astrojs/sitemap`](https://docs.astro.build/en/guides/integrations-guide/sitemap/)
- **Data sources**: live SoundCloud tracks (via `soundcloud.ts`), fetched at build time and cached to disk; upcoming gigs are static data in `Gigs.astro`

## Project Structure

```text
/
├── public/                  # Static assets: images, fonts, favicons, og-image
├── src/
│   ├── components/          # Astro UI sections (Hero, About, Milestones, Gigs,
│   │                         # LatestTracks, Mixes, Gallery, Booking)
│   ├── layouts/              # Layout.astro — <head>, SEO/OG/Twitter meta, JSON-LD
│   ├── lib/
│   │   ├── soundcloudTracks.ts  # Fetches + caches latest SoundCloud tracks
│   │   └── spotifyLinks.ts      # Manual SoundCloud → Spotify track link mapping
│   ├── pages/                # index, 404, privacy-policy, terms
│   └── styles/                # Global CSS
└── package.json
```

## Data

Upcoming gigs are hardcoded in `src/components/Gigs.astro` (filtered to today-or-later by date) — update that list directly to add or remove shows.

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
