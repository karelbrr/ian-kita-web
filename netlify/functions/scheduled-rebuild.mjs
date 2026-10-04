// Rebuilds the site three times a week, so the upcoming-shows list drops past
// dates and the latest SoundCloud tracks are refetched without anyone
// redeploying. Not every night: each rebuild is a full deploy, and Netlify's
// credit-based free plan (300 credits a month, 15 per deploy) can't cover one a
// day. Visitors' browsers already hide past shows in between.
//
// Setup (once, in the Netlify dashboard):
//   1. Site configuration > Build & deploy > Build hooks: add a hook for `main`.
//   2. Site configuration > Environment variables: add BUILD_HOOK_URL with the
//      hook's URL, scoped to Functions.
// Scheduled functions only run on the published deploy, at the time below (UTC).

export default async () => {
    const hook = process.env.BUILD_HOOK_URL;
    if (!hook) {
        console.warn('scheduled-rebuild: BUILD_HOOK_URL is not set, skipping.');
        return new Response('BUILD_HOOK_URL is not set', { status: 500 });
    }

    const response = await fetch(hook, { method: 'POST', body: '{}' });
    if (!response.ok) {
        console.error(`scheduled-rebuild: build hook answered ${response.status}.`);
    }
    return new Response(null, { status: response.ok ? 202 : 502 });
};

// Monday, Wednesday and Friday at 00:15 UTC, shortly after midnight in Prague
// (01:15 or 02:15), so shows from the days before are gone by morning.
export const config = { schedule: '15 0 * * 1,3,5' };
