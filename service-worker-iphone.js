const CACHE_VERSION = 19;
const CURRENT_CACHES = { prefetch: `prefetch-cache-v${CACHE_VERSION}` };
const URLS_TO_PREFETCH = [
  './index.html',
  './screen-iphone.mp4'
];

self.addEventListener('install', event => {
  console.log('Handling install event. Resources to prefetch:', URLS_TO_PREFETCH);
  self.skipWaiting();
  event.waitUntil(
    caches.open(CURRENT_CACHES.prefetch).then(cache =>
      cache.addAll(URLS_TO_PREFETCH)
    )
  );
});

self.addEventListener('activate', event => {
  const expectedCacheNames = Object.values(CURRENT_CACHES);
  event.waitUntil((async () => {
    for (const cacheName of (await caches.keys())) {
      if (!expectedCacheNames.includes(cacheName)) {
        console.log('Deleting out of date cache:', cacheName),
        await caches.delete(cacheName);
      }
    }
  })());
});

self.addEventListener('fetch', event => {
  const { request, request: { headers, url } } = event;
  console.log('Handling fetch event for', url);

  const range = headers.get('range');
  if (range) {
    let [_, pos, posEnd] = /^bytes\=(\d+)\-(\d+)/g.exec(range);
    pos = +pos;
    posEnd = +posEnd;
    if (pos >= posEnd) return;
    console.log(`Range request for ${url}, starting position: ${pos}, ending position: ${posEnd}`);

    event.respondWith((async () => {
      const cache = await caches.open(CURRENT_CACHES.prefetch);
      const ab = await ((await cache.match(url)) || (await fetch(request))).arrayBuffer();
      return new Response(
        ab.slice(pos, posEnd),
        {
          status: 206,
          statusText: 'Partial Content',
          headers: [
            ['Content-Type', 'video/mp4'],
            ['Content-Length', `${(posEnd - pos)}`],
            ['Content-Range', `bytes ${pos}-${posEnd}/${ab.byteLength}`],
            ['Accept-Ranges', 'bytes']
          ]
        }
      );
    })());
  } else {
    console.log('Non-range request for', url);
    event.respondWith((async () =>
      (await caches.match(request)) || (await fetch(request))
    )());
  }
});
