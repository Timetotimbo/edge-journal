// Cloudflare Pages Function: proxies the ForexFactory-style economic calendar feed server-side.
// The feed has no CORS header, so the browser can't fetch it directly; this fetches it from the edge
// and caches good answers briefly. A failed fetch is never cached, and comes back as an error with the
// feed's status, so the page says the news couldn't load instead of showing an empty week.
// Only "thisweek" exists on this mirror — "nextweek"/"lastweek" 404.
const SOURCE = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

export const onRequestGet: PagesFunction = async (context) => {
  const cache = caches.default;
  const cacheKey = new Request(new URL('/api/calendar', context.request.url).toString());
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let status = 0, events: unknown = null;
  try {
    const upstream = await fetch(SOURCE, { headers: { accept: 'application/json' } });
    status = upstream.status;
    if (upstream.ok) events = await upstream.json();
  } catch { /* status stays 0 */ }

  if (!Array.isArray(events) || !events.length) {
    return new Response(JSON.stringify({ error: `news feed unavailable (status ${status || 'no response'})` }), {
      status: 502, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
  const res = new Response(JSON.stringify(events), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
  });
  context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
};
