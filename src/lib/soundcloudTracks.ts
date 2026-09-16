import fs from "node:fs";
import path from "node:path";
import {Soundcloud} from "soundcloud.ts";
import type {SoundcloudTrack} from "soundcloud.ts";
import {getSpotifyLink} from "./spotifyLinks";

const CACHE_DIR: string = path.resolve(process.cwd(), ".cache");
const CACHE_FILE: string = path.join(CACHE_DIR, "tracks.json");
const CACHE_TTL_MS: number = 24 * 60 * 60 * 1000; // 1 day

export interface CleanTrack {
    title: string;
    cover: string;
    links: { soundcloud: string; spotify?: string };
}

interface Cache {
    fetchedAt: number;
    tracks: CleanTrack[];
}

function readCache(): Cache | null {
    try {
        return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    } catch {
        return null;
    }
}

function writeCache(tracks: CleanTrack[]) {
    try {
        fs.mkdirSync(CACHE_DIR, {recursive: true});
        fs.writeFileSync(CACHE_FILE, JSON.stringify({fetchedAt: Date.now(), tracks} satisfies Cache, null, 2));
    } catch (err) {
        console.warn("[soundcloudTracks] could not write cache:", err);
    }
}

// SoundCloud's API returns artwork_url at its "-large" size, which is only
// 100x100px and looks blurry once upscaled to fill a card. SoundCloud serves
// the same artwork at other sizes from the same URL, up to 500x500.
function upscaleArtwork(artworkUrl: string | null): string {
    if (!artworkUrl) return "";
    return artworkUrl.replace(/-large\.(jpg|png)$/, "-t500x500.$1");
}

async function fetchLiveTracks(profileUrl: string): Promise<CleanTrack[]> {
    const sc = new Soundcloud();
    const soundcloudUser = await sc.resolve.get(profileUrl, true);
    // A single limited page is enough for a "latest tracks" list and is far
    // faster than sc.users.tracks(), which pages through the entire back-catalog.
    const tracksResponse = await sc.api.getV2(`users/${soundcloudUser.id}/tracks`, {limit: 20});
    const tracks: SoundcloudTrack[] = tracksResponse.collection;

    return tracks.map((track: SoundcloudTrack) => ({
        title: track.title,
        cover: upscaleArtwork(track.artwork_url),
        links: {soundcloud: track.permalink_url},
    }));
}

// The Spotify mapping is applied on every read (cached or live) rather than
// baked into the cache file, so editing spotifyLinks.ts takes effect
// immediately without needing to invalidate the SoundCloud cache.
function withSpotifyLinks(tracks: CleanTrack[]): CleanTrack[] {
    return tracks.map((track) => {
        const spotify = getSpotifyLink(track.links.soundcloud);
        return spotify ? { ...track, links: { ...track.links, spotify } } : track;
    });
}

/**
 * Returns the artist's latest SoundCloud tracks, cached to disk for CACHE_TTL_MS
 * so repeated dev reloads/builds don't re-hit the live API every time. Falls back
 * to a stale cache (rather than failing the build) if the live fetch errors.
 */
export async function getLatestTracks(profileUrl: string, count: number): Promise<CleanTrack[]> {
    const cached = readCache();
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return withSpotifyLinks(cached.tracks.slice(0, count));
    }

    try {
        const tracks = await fetchLiveTracks(profileUrl);
        writeCache(tracks);
        return withSpotifyLinks(tracks.slice(0, count));
    } catch (err) {
        if (cached) {
            console.warn("[soundcloudTracks] live fetch failed, using stale cache:", err);
            return withSpotifyLinks(cached.tracks.slice(0, count));
        }
        throw err;
    }
}
