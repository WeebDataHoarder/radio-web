
/**
 *
 * @param request
 * @returns {Promise<Response>}
 */
async function tryToCache (request) {
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
    self.skipWaiting();
});

self.addEventListener("activate", function (event) {
    event.waitUntil((async () => {
        console.log("[ServiceWorker] activating worker " + self.registration.scope);
        const keyList = await caches.keys();
        await Promise.all(keyList.map(async (key) => {
            if (key === cacheName) { return; }
            console.log("[ServiceWorker] deleted old cache " + key + ", scope " + self.registration.scope);
            await caches.delete(key);
        }));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const url = event.request.url;
    const scope = self.registration.scope;
    const path = (new URL(url)).pathname;

    // Skip non-get
    if (event.request.method !== "GET") {
        return;
    }

    // Skip range requests
    if (event.request.headers.has("range")) {
        return;
    }

    // Skip cross-origin requests
    if (!url.startsWith(scope)) {
        return;
    }

    console.log("[ServiceWorker] fetch " + url + ", path " + path + ", scope " + self.registration.scope);

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
        event.respondWith(tryToCache(event.request));
        return;
    }

    if (/^\/api\//.test(path)) {
        return;
    }

    if (/^\/(js|css|img|fonts)\//.test(path)) { //Static files
        event.respondWith(tryToCache(event.request));
        return;
    }

    if (/^\/player\//.test(path)) { //TODO: cache these for x minutes
        return;
    }

    event.respondWith(tryToCache(event.request)); //Cache everything else
});

self.addEventListener("message", function (event) {

});

self.addEventListener("push", function (event) {

});