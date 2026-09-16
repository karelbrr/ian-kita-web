/**
 * Manual SoundCloud → Spotify link mapping.
 *
 * Not every SoundCloud upload (radio shows, live sets, remixes) has an
 * official Spotify release, so this is curated by hand rather than
 * auto-matched by title — a fuzzy title search would risk linking to the
 * wrong track. Key each entry by the track's SoundCloud permalink_url
 * (the same value used for links.soundcloud) and add the Spotify track/
 * release URL as the value. Tracks with no entry here simply won't show
 * a Spotify button.
 */
export const SPOTIFY_LINKS: Record<string, string> = {
  // "https://soundcloud.com/iankitadj/ian-kita-ritual-je-tady-1": "https://open.spotify.com/track/...",
};

export function getSpotifyLink(soundcloudUrl: string): string | undefined {
  return SPOTIFY_LINKS[soundcloudUrl];
}
