const shellCache = 'laterclip-shell-offline1';
const shellFiles = [
 'index.html','style.css?v=offline1','app.js?v=offline1','offline-audio.js?v=offline1',
 'connection-store.js?v=20261020-remember1','config.js','api.js?v=20261019-direct1',
 'thumbnail.js?v=20261018-facebook1','manifest.webmanifest','icon.svg','apple-touch-icon.png'
];
const root = new URL(self.registration.scope);
const index = new URL('index.html',root).href;
const assets = new Set(shellFiles.map(file=>new URL(file,root).href));

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(shellCache).then(cache=>
  cache.addAll([...assets].map(url=>new Request(url,{cache:'reload'})))));
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const names = await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith('laterclip-shell-') && name!==shellCache)
   .map(name=>caches.delete(name)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const {request} = event;
 if (request.method !== 'GET') return;
 const url = new URL(request.url);
 if (request.mode === 'navigate' && url.origin === root.origin &&
     [root.pathname,new URL(index).pathname].includes(url.pathname)) {
  event.respondWith(fetch(request).catch(async()=>{
   const cache = await caches.open(shellCache);
   return cache.match(index);
  }));
 } else if (assets.has(request.url)) {
  event.respondWith(caches.open(shellCache).then(cache=>cache.match(request)).then(response=>response || fetch(request)));
 }
});
