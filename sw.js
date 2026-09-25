const CACHE='elektrotoolbox-v6-1-1';
const CORE=['./','./index.html','./app.html','./privacy.html','./voorwaarden.html','./manifest.webmanifest','./assets/styles.css','./assets/v5-futuristic.css','./assets/v6-hyperfield.css','./assets/app.js','./assets/v6-hyperfield.js','./assets/calc-engine.js','./assets/favicon.svg','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  const critical=e.request.mode==='navigate'||/\.(?:html|js|css)$/.test(u.pathname);
  if(critical){
    e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;}).catch(()=>caches.match(e.request).then(x=>x||caches.match('./app.html'))));
  }else{
    e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;})));
  }
});
