// Production PWA
const CACHE = 'planner-v17';
const ASSETS = ['./','./index.html','./manifest.json','./css/style.css','./js/db.js','./js/auth.js','./js/day.js','./js/habits.js','./js/week.js','./js/month.js','./js/profile.js','./js/app.js','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'})))));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('planner-')&&!k.startsWith('planner-test-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method==='GET' && e.request.url.startsWith(self.registration.scope)){
    e.respondWith(caches.open(CACHE).then(c=>c.match(e.request).then(cached=>cached || fetch(e.request))));
  }
});