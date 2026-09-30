// Rebuilds the site once a day, so the upcoming-shows list drops past dates
// and the latest SoundCloud tracks are refetched without anyone redeploying.
//
// Setup (once, in the Netlify dashboard):
//   1. Site configuration > Build & deploy > Build hooks: add a hook for `main`.
//   2. Site configuration > Environment variables: add BUILD_HOOK_URL with the
//      hook's URL, scoped to Functions.
// Scheduled functions only run on the published deploy, at the time below (UTC).

export default async () => {
    const hook = process.env.BUILD_HOOK_URL;
    if (!hook) {
        console.warn('daily-rebuild: BUILD_HOOK_URL is not set, skipping.');
        return new Response('BUILD_HOOK_URL is not set', { status: 500 });
    }

    const response = await fetch(hook, { method: 'POST', body: '{}' });
    if (!response.ok) {
        console.error(`daily-rebuild: build hook answered ${response.status}.`);
    }
    return new Response(null, { status: response.ok ? 202 : 502 });
};

// 00:15 UTC is shortly after midnight in Prague (01:15 or 02:15), so shows
// from the day before are gone by morning.
export const config = { schedule: '15 0 * * *' };
