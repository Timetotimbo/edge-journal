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
      const file = form.getAll('chart').find(f => f && typeof f !== 'string' && f.type.startsWith('image/'));
      if (file) {
        const cache = await caches.open('shared-chart');
        await cache.put('/shared-chart', new Response(file, { headers: { 'Content-Type': file.type } }));
      }
    } catch { /* open the journal anyway */ }
    return Response.redirect('/?shared=1#journal', 303);
  })());
});
