
/**
 *
 * @param request
 * @returns {Promise<Response>}
 */
self.tryToCache = async (request) => {
    const r = await caches.match(request);
    if(r){
        console.log("[ServiceWorker] returned from cache " + request.url + ", scope " + self.registration.scope);
        return r;
    }
    const response = await fetch(request);

    if(response.ok){ //Only cache if ok
        const cache = await caches.open(cacheName);
        cache.put(request, response.clone());
        console.log("[ServiceWorker] cached " + request.url + ", scope " + self.registration.scope);
    }
    return response;
}

self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(cacheName);
        await cache.addAll(
            [
                '/img/ab-logo.svg',
                '/img/add.svg',
                '/img/download.svg',
                '/img/external-player.svg',
                '/img/heart.svg',
                '/img/jps-logo-small.png',
                '/img/list-play-hover.png',
                '/img/list-play-light.png',
                '/img/mute.svg',
                '/img/next.svg',
                '/img/now-playing.svg',
                '/img/pause.svg',
                '/img/play.svg',
                '/img/prev.svg',
                '/img/repeat-off.svg',
                '/img/repeat-on.svg',
                '/img/shuffle-off.svg',
                '/img/shuffle-on.svg',
                '/img/volume.svg',
                '/img/no-cover.jpg',
                '/help.html',
            ]
        );
    })());
    //self.skipWaiting();
});

self.addEventListener("activate", function (event) {
    event.waitUntil((async () => {
        const keyList = await caches.keys();
        await Promise.all(keyList.map(async (key) => {
            if (key === cacheName) { return; }
            await caches.delete(key);
        }));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const url = event.request.url;
    const scope = self.registration.scope;
    console.log("[ServiceWorker] fetch " + url + ", scope " + self.registration.scope);

    // Skip cross-origin requests
    if (!url.startsWith(scope)) {
        return;
    }

    const path = url.pathname;

    if (/^\/(stream|service)\//.test(path)) {
        return;
    }

    if (/^\/$/.test(path)) { //Do not cache index, contains changes
        return;
    }

    if (/^\/import/.test(path)) {
        return;
    }

    if (/^\/api\/(cover|download|lyrics)\//.test(path)) { // Parts of API that can be cached
        event.respondWith(self.tryToCache(event.request)());
        return;
    }

    if (/^\/api\//.test(path)) {
        return;
    }

    if (/^\/(js|css|img|fonts|dict)\//.test(path)) { //Static files
        event.respondWith(self.tryToCache(event.request)());
        return;
    }

    if (/^\/player\//.test(path)) { //TODO: cache these for x minutes
        return;
    }

    event.respondWith(self.tryToCache(event.request)()); //Cache everything else
});

self.addEventListener("message", function (event) {

});

self.addEventListener("push", function (event) {

});