"use strict";

self.addEventListener("install", function(event) {
	event.waitUntil(
		caches.open("default").then(function(cache) {
			return cache.addAll(
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
					//'/img/script-example.png',
					//'/radio-downloader.sh',
				]
			);
		})
);
	self.skipWaiting();
});

self.addEventListener("activate", function(event) {
	event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
	const url = event.request.url;
	const scope = self.registration.scope;

	// Skip cross-origin requests
	if (!url.startsWith(scope)) {
		return;
	}

	const path = url.pathname;

	if(/^\/stream\//.test(path)){
		//event.respondWith(fetch(event.request));
		return;
	}

	if(/^\/api\/(cover|download)\//.test(path)){
		event.respondWith(
	    caches.match(event.request).then(function(response) {
	      return response || fetch(event.request);
	    })
	  );
		return;
	}

	if(/^\/api\//.test(path)){
		//event.respondWith(fetch(event.request));
		return;
	}
  event.respondWith(async function() {
    const cachedResponse = await caches.match(event.request);
    if (cachedResponse) return cachedResponse;
    return fetch(event.request);
  }());
});

self.addEventListener("message", function(event) {

});

self.addEventListener("push", function(event) {

});
