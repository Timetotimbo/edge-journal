// Cloudflare Pages Function: proxies the ForexFactory-style economic calendar feed server-side.
// The feed has no CORS header, so the browser can't fetch it directly; this fetches it from the edge
// (no CORS involved server-to-server) and caches briefly so a busy day of page loads is one upstream hit.
// Only "thisweek" exists on this mirror — "nextweek"/"lastweek" 404 — so the week rolls over at its own boundary.
const SOURCE = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

export const onRequestGet: PagesFunction = async (context) => {
  const cache = caches.default;
  const cacheKey = new Request(context.request.url, context.request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const upstream = await fetch(SOURCE, { headers: { accept: 'application/json' } });
  const events = upstream.ok ? await upstream.json() : [];

  const res = new Response(JSON.stringify(events), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
  });
  context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
};
