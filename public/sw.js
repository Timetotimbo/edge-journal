// Edge Journal's service worker. Its one job: receive a chart picture shared from the phone's gallery (Share → Edge
// Journal), keep it for a moment, and open the journal, which picks it up and opens Mark up chart on it.
// Nothing else is cached, so a deploy is never held back by an old copy.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'POST' || url.pathname !== '/share-chart') return;
  e.respondWith((async () => {
    try {
      const form = await e.request.formData();
      const files = form.getAll('chart').filter(f => f && typeof f !== 'string' && f.type.startsWith('image/'));
      const cache = await caches.open('shared-chart');
      // Each kept with its name and date, so a batch can be filed under the days the screenshots were taken
      await Promise.all(files.map((f, i) => cache.put(`/shared-chart/${i}`, new Response(f, { headers: { 'Content-Type': f.type, 'X-Name': encodeURIComponent(f.name || ''), 'X-Modified': String(f.lastModified || '') } }))));
    } catch { /* open the journal anyway */ }
    return Response.redirect('/?shared=1#journal', 303);
  })());
});
