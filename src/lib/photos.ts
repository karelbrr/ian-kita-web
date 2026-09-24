import type { ImageMetadata } from 'astro';

/**
 * Every photo under src/assets/photos, keyed by its project-root path
 * (e.g. "/src/assets/photos/coal-festival.jpg"). The CMS stores exactly this
 * path in the data files, so content editors can pick any uploaded photo and
 * it still goes through Astro's image optimisation.
 */
const photoModules = import.meta.glob<{ default: ImageMetadata }>(
    '/src/assets/photos/*.{jpg,jpeg,png,webp,avif}',
    { eager: true },
);

export function resolvePhoto(url: string | undefined | null): ImageMetadata | undefined {
    if (!url) return undefined;
    return photoModules[url]?.default;
}
