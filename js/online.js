const basePageUrl = new URL(document.location.origin);
if (basePageUrl.searchParams.get("apiurl") !== null) {
    if (basePageUrl.searchParams.get("apiurl") === "") {
        window.localStorage.removeItem("radio-api-url");
    } else {
        window.localStorage.setItem("radio-api-url", String(basePageUrl.searchParams.get("apiurl")).trimEnd("/"));
    }
}

const baseApiUrl = window.localStorage.getItem("radio-api-url") != null ? window.localStorage.getItem("radio-api-url") : location.protocol + '//' + document.domain + ':' + location.port;
let apiKey = null;

let currentQueue = [];
let np = [];
let nr = null;
let listeners = [];

let searchRequest = null;
let searchTimer;
const searchTimeout = 500;
let oldQuery = "";
let socket = null;


document.addEventListener("DOMContentLoaded", function() {
    window.addEventListener('resize', function () {
        //adjustPlayerHeights();
    });

    initWebsite();
});

function applyTagMeta(meta){
    if("dl-link-type" in meta){
        document.querySelector("#np-download").classList.add(meta["dl-link-type"]);
    }
    if("dl-link-href" in meta){
        document.querySelector("#np-download").setAttribute("href", meta["dl-link-href"]);
    }
}

const uplayer = new UPlayer({
    "limitCodecs": ["audio/flac", "audio/ogg;codecs=opus", "audio/mpeg;codecs=mp3", "audio/aac"],
    "volume": window.localStorage.getItem("radio-volume") !== null ? window.localStorage.getItem("radio-volume") / 100 : 1.0,
    "preload": false,
    "streaming": true,
    "muted": false,
    "retry": true,
    "play-pause-element": document.querySelector(".play-pause"),
    //"progress-minutes-element": document.querySelector(".radio-current-minutes"),
    //"progress-seconds-element": document.querySelector(".radio-current-seconds"),
    //"duration-minutes-element": document.querySelector(".radio-duration-minutes"),
    //"duration-seconds-element": document.querySelector(".radio-duration-seconds"),
    //"progress-element": document.querySelector(".radio-song-played-progress"),
    //"buffer-progress-element": document.querySelector(".radio-song-played-progress"),
    "mute-element": document.querySelector(".mute"),
    "volume-element": document.querySelector(".volume-slider"),
    "on-ready": function () {
        document.querySelector(".play-pause").classList.remove("hidden");
    }
});

let audioStream;

function initWebsite() {
    document.querySelector("#radio-quality").addEventListener('change', function () {
        const playing = uplayer.isPlaying();

        for (let i = 0; i < compatibleAudioStreams.length; ++i) {
            if (compatibleAudioStreams[i].id == this.value) {
                audioStream = compatibleAudioStreams[i];
                break;
            }
        }

        window.localStorage.setItem("radio-stream-id", this.value);

        uplayer.init(document.getElementById("stream-" + this.value).href, [audioStream.format]);
        if (playing) {
            uplayer.play();
        }
    });

    document.querySelector("#api-key").addEventListener('keypress', function (e) {
        if (e.which === 13) {
            apiKeyIdentify(this.value);
        }
    });

    document.querySelector("#radio-skip").addEventListener('click', function () {
        if (listeners.num_listeners <= 2 || confirm("Are you sure you want to skip this track? You are (not) alone.")) {
            apiRequest("/api/skip").then(r => {

            });
        }
    });


    setInterval(function () {
        if (np === null) {
            return;
        }

        const totalDuration = np.duration;
        const currentDuration = Math.floor((new Date()).getTime() / 1000 - np.started);

        const current = Math.max(0, Math.min(totalDuration, currentDuration));

        document.querySelectorAll(".np-seconds").forEach((e) => { e.textContent = ("" + (current % 60)).padStart(2, "0"); });
        document.querySelectorAll(".np-minutes").forEach((e) => { e.textContent = ("" + Math.floor(current / 60)).padStart(2, "0"); });
        document.querySelectorAll(".np-duration-seconds").forEach((e) => { e.textContent = ("" + (totalDuration % 60)).padStart(2, "0"); });
        document.querySelectorAll(".np-duration-minutes").forEach((e) => { e.textContent = ("" + Math.floor(totalDuration / 60)).padStart(2, "0"); });
        document.querySelector("#song-played-progress").value = current / totalDuration;

    }, 200);

    if ("Notification" in window) {
        document.querySelector("#notify-check-group").style["display"] = "inline-block";
        if (Notification.permission === "granted" && window.localStorage.getItem("radio-notifications") == "on") {
            document.querySelector("#notify-check").checked = true;
        }

        document.querySelector("#notify-check").addEventListener("change", function () {
            if (this.checked) {
                Notification.requestPermission().then(function (result) {
                    if (result !== "granted") {
                        document.querySelector("#notify-check").checked = false;
                    } else {
                        window.localStorage.setItem("radio-notifications", document.querySelector("#notify-check").checked ? "on" : "off");
                    }
                })
            } else {
                this.checked = false;
                window.localStorage.setItem("radio-notifications", "off");
            }
        });
    }

    document.querySelector("#radio-player").addEventListener('click', function (ev) {
        if(ev.target.classList.contains("song-favorite")){
            const username = document.querySelector("#current-nick").textContent.toLowerCase();
            const thisElement = ev.target;
            if (username === "") {
                return;
            }

            apiRequest("/api/favorites/" + username + "/" + thisElement.getAttribute("data-track-hash"), thisElement.classList.contains("favorited") ? "DELETE" : "PUT").then((data) => {
                //thisElement.classList.add("favorited");
            });
        }

    });

    document.querySelector("#search-results").addEventListener('mousedown',function (a) {
        const thisElement = a.target.closest(".search-result-queue");
        if(thisElement !== null){
            const target = a.target;
            const songHash = thisElement.getAttribute("data-track-hash");
            if (a.ctrlKey || (a.which === 2 || a.button === 2)) {
                window.open(baseApiUrl + "/player/hash/" + songHash, '_blank');
                a.stopImmediatePropagation();
                return;
            }
            if (target.classList.contains("song-favorite")/* || target.hasClass("song-album") || target.hasClass("song-artist") || target.hasClass("song-title")*/) {
                return;
            }
            apiRequest("/api/request/" + songHash).then((data) => {
                if (data.hash === songHash) {
                    thisElement.style["display"] = "none"; //TODO animate
                }
            });
        }
    });

    document.querySelector(".hash-area").addEventListener('click', function () {
        const temp = document.createElement("input");
        document.querySelector("body").append(temp);
        temp.value = this.textContent;
        temp.select();
        document.execCommand("copy");
        temp.remove();
    });

    document.querySelector("#search-queryrandom").addEventListener('click', function () {
        if (oldQuery === "") {
            return;
        }

        apiRequest("/api/request/random?q=" + encodeURIComponent(oldQuery)).then((data) => {

        });
    });


    initSearch();

    /*
    setTimeout(function(){
        updateQueueData(currentQueue);
    }, 30 * 1000);*/
}

function initWebSocket() {
    const socketUrl = new URL(baseApiUrl);
    socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    let fullUrl = socketUrl.href + '/api/events/basic';
    if (apiKey !== null) {
        socketUrl.username = apiKey;
        fullUrl = socketUrl.href + '/api/events/all'
    }

    if (socket !== null) {
        socket.close();
    }
    socket = new WebSocket(fullUrl);

    socket.onclose = function (event) {
        if (event.wasClean) {
            return;
        }
        console.log("WebSocket closed, reconnecting");
        console.log(event)
        setTimeout(function () {
            initWebSocket();
        }, 2000);
    };
    socket.onerror = function () {
        socket.close();
    };
    socket.onmessage = function (event) {
        const data = JSON.parse(event.data);
        if (data.type == 'queue') {
            if (data.data.action == 'initial') {
                currentQueue = data.data.queue;
                updateQueueData(currentQueue);
            } else if (data.data.action == 'remove') {
                for (let i = 0; i < currentQueue.length; ++i) {
                    if (
                        currentQueue[i].id == data.data.song.id
                    ) {
                        currentQueue.splice(i, 1);
                        break;
                    }
                }
                updateQueueData(currentQueue);
            } else if (data.data.action == 'add') {
                data.data.song.queue_id = data.data.queue_id;
                currentQueue.push(data.data.song);
                updateQueueData(currentQueue);
            } else if (data.data.action == 'random') {
                nr = data.data.song;
                updateQueueData(currentQueue);
            } else if (data.data.action == 'clear') {
                currentQueue = [];
                updateQueueData(currentQueue);
            }
        } else if (data.type === 'playing') {
            if(np != null){
                nr = null;
            }
            np = data.data;
            updateTrackData(np);
            updateQueueData(currentQueue);
        } else if (data.type === 'listeners') {
            listeners = data.data;
            if (listeners.num_listeners <= 2) {
                document.querySelector("#radio-skip").style.display = "";
            } else {
                document.querySelector("#radio-skip").style.display = "none";
            }

            if ("named_listeners" in data.data) {
                document.querySelector("#listeners").textContent = "Listeners: " + (data.data.num_listeners - data.data.named_listeners.length) + " guest(s), " + data.data.named_listeners.join(", ");
            } else {
                document.querySelector("#listeners").textContent = "Listeners: " + data.data.num_listeners + " guest(s)";
            }
        } else if (data.type === 'favorite') {
            const username = document.querySelector("#current-nick").textContent.toLowerCase();
            document.querySelectorAll(".song-favorite[data-track-hash=\"" + data.data.song.hash + "\"]").forEach((targetElement) => {
                if (data.data.user.toLowerCase() === username) {
                    if (data.data.action === "add") {
                        targetElement.classList.add("favorited");
                    } else if (data.data.action === "remove") {
                        targetElement.classList.remove("favorited");
                    }
                }
                targetElement.textContent = data.data.song.favored_by.length > 0 ? data.data.song.favored_by.length : "";
                targetElement.classList.add("shake");
                targetElement.addEventListener('animationend webkitAnimationEnd oAnimationEnd', function () {
                    targetElement.classList.remove("shake");
                });
            });
        }
    };
}

function updateTrackData(data) {
    document.title = data.artist + " - " + data.title + " (" + data.album + ") :: anime(bits) #radio";
    document.querySelectorAll(".np-artist").forEach((e) => {
        e.textContent = data.artist;
    });
    document.querySelectorAll(".np-album").forEach((e) => {
        e.textContent = data.album;
    });
    document.querySelectorAll(".np-song").forEach((e) => {
        e.textContent = data.title;
    });

    if (data.hash) {
        document.querySelector(".np-hash").textContent = data.hash;
        document.querySelector("#radio-favorite").setAttribute("data-track-hash", data.hash);
    }

    const username = document.querySelector("#current-nick").textContent.toLowerCase();
    if ('favored_by' in data && username !== "") {
        if (data.favored_by.includes(username)) {
            document.querySelector("#radio-favorite").classList.add("favorited");
        } else {
            document.querySelector("#radio-favorite").classList.remove("favorited");
        }
        document.querySelector("#radio-favorite").textContent = data.favored_by.length > 0 ? data.favored_by.length : "";
    }
    document.querySelector("#np-download").classList.remove("ab");
    document.querySelector("#np-download").classList.remove("jps");
    document.querySelector("#np-download").classList.remove("red");
    document.querySelector("#np-download").classList.remove("bbt");
    document.querySelector("#np-tags.tag-area").innerHTML = "";

    let tagData = getTagEntries(data);
    applyTagEntries(document.querySelector("#np-tags.tag-area"), tagData.tags);
    applyTagMeta(tagData.meta);

    if (data.hash) {
        document.querySelector("#np-player").setAttribute( "href", baseApiUrl + "/player/hash/" + data.hash);
    }
    let imageUrl = (data.cover !== null ? '/api/cover/' + data.cover + '/large' : '/img/no-cover.jpg');
    document.querySelectorAll(".np-image").forEach((e) => {
       e.setAttribute("src", imageUrl);
    });
    document.querySelector(".body-blur").style["background-image"] = "url("+ imageUrl +")";


    pushMediaSessionMetadata(data);


    if (uplayer.isPlaying()) {
        setTimeout(function () {
            pushPlayNotification(data, "np");
        }, 6000);
    }
}

function createQueueEntry(data, startTime = null) {
    const username = document.querySelector("#current-nick").textContent.toLowerCase();

    const e = document.createElement("div");
    e.classList.add("song", "radio-song-container");
    {
        const fit = document.createElement("div");
        fit.classList.add("queue-fit");
        const im = document.createElement("img");
        im.classList.add("queue-cover");
        im.setAttribute("src", data["cover"] !== null ? "/api/cover/" + data["cover"] + "/small" : "/img/no-cover.jpg");
        im.setAttribute("loading", "lazy");
        fit.append(im);

        e.append(fit);
    }
    {
        const c = document.createElement("div");
        c.classList.add("song-now-playing-icon-container");
        if("random" in data && data.random){
            const im = document.createElement("img");
            im.classList.add("now-playing");
            im.src = "/img/shuffle-on.svg";
            c.append(im);
        }else{
            const n = document.createElement("div");
            n.classList.add("now-playing", "song-favorite", "user-feature");
            if('favored_by' in data && data.favored_by.includes(username) ){
                n.classList.add("favorited");
            }
            if('favored_by' in data && data.favored_by.length > 0){
                n.textContent = data.favored_by.length;
            }
            n.setAttribute("data-track-hash", data.hash);
            c.append(n);
        }

        e.append(c);
    }
    {
        const c = document.createElement("div");
        c.classList.add("song-meta-data");

        const title = document.createElement("span");
        title.classList.add("song-title");
        title.textContent = data["title"];
        c.append(title);

        const artist = document.createElement("span");
        artist.classList.add("song-artist");
        artist.textContent = data["artist"];
        c.append(artist);

        const album = document.createElement("span");
        album.classList.add("song-album");
        album.textContent = data["album"];
        c.append(album);

        e.append(c);
    }
    {
        const duration = document.createElement("span");
        duration.classList.add("song-duration");
        duration.textContent = (startTime !== null ? "in" + String.fromCharCode(160) + "~" + Math.ceil((startTime - (Date.now() / 1000)) / 60) + "m" : ("" + Math.floor(data.duration / 60)).padStart(2, "0") + ':' + ("" + (data.duration % 60)).padStart(2, "0"));
        e.append(duration);
    }

    return e;
}

function createResultsEntry(data) {
    const username = document.querySelector("#current-nick").textContent.toLowerCase();

    const e = document.createElement("div");
    e.classList.add("song", "radio-song-container", "search-result-queue");
    e.setAttribute("data-track-hash", data.hash);
    {
        const im = document.createElement("img");
        im.classList.add("queue-add");
        im.src = "/img/add.svg";
        e.append(im);
    }
    {
        const fit = document.createElement("div");
        fit.classList.add("queue-fit");
        const im = document.createElement("img");
        im.classList.add("queue-cover");
        im.setAttribute("src", data["cover"] !== null ? "/api/cover/" + data["cover"] + "/small" : "/img/no-cover.jpg");
        im.setAttribute("loading", "lazy");
        fit.append(im);

        e.append(fit);
    }
    {
        const c = document.createElement("div");
        c.classList.add("song-now-playing-icon-container");
        if("random" in data && data.random){
            const im = document.createElement("img");
            im.classList.add("now-playing");
            im.src = "/img/shuffle-on.svg";
            c.append(im);
        }else{
            const n = document.createElement("div");
            n.classList.add("now-playing", "song-favorite", "user-feature");
            if('favored_by' in data && data.favored_by.includes(username) ){
                n.classList.add("favorited");
            }
            if('favored_by' in data && data.favored_by.length > 0){
                n.textContent = data.favored_by.length;
            }
            n.setAttribute("data-track-hash", data.hash);
            c.append(n);
        }

        e.append(c);
    }
    {
        const c = document.createElement("div");
        c.classList.add("song-meta-data");

        const title = document.createElement("span");
        title.classList.add("song-title");
        title.textContent = data["title"];
        c.append(title);

        const artist = document.createElement("span");
        artist.classList.add("song-artist");
        artist.textContent = data["artist"];
        c.append(artist);

        const album = document.createElement("span");
        album.classList.add("song-album");
        album.textContent = data["album"];
        c.append(album);

        e.append(c);
    }
    {
        const duration = document.createElement("span");
        duration.classList.add("song-duration");
        duration.textContent = ("" + Math.floor(data.duration / 60)).padStart(2, "0") + ':' + ("" + (data.duration % 60)).padStart(2, "0");
        e.append(duration);
    }

    return e;
}

function updateQueueData(res) {
    let queueDuration = np && 'started' in np ? np.started + np.duration : null;
    if (res.length == 0) {
        document.querySelector("#radio-queue").innerHTML = "";
        if (nr !== null) {
            if (currentQueue.length != 0 || np.id == nr.id) {
                return;
            }
            document.querySelector("#radio-queue").append(createQueueEntry({
                "title": nr.title,
                "artist": nr.artist,
                "album": nr.album,
                "hash": nr.hash,
                "duration": nr.duration,
                "random": true,
                "cover": nr.cover,
            }, queueDuration));
        } else {

            document.querySelector("#radio-queue").append(createQueueEntry({
                "title": "Random playback",
                "artist": "UP NEXT",
                "album": "???",
                "hash": "00000000000000000000000000000000",
                "cover": null,
                "duration": 0,
                "random": true
            }, queueDuration));
        }
    } else {
        document.querySelector("#radio-queue").innerHTML = "";
        for (let i = 0; i < res.length; i++) {
            document.querySelector("#radio-queue").append(createQueueEntry(res[i], queueDuration));
            if (queueDuration !== null) {
                queueDuration += res[i].duration;
            }
        }
    }
}

function apiKeyIdentify(key) {
    apiKey = key;
    apiRequest("/api/user/info").then((data) => {
        if (data.user) {
            docCookies.setItem("radio-apikey", apiKey, Infinity, "/", window.location.hostname, true);
            nickIdentify(data.user);
            initWebSocket();
        } else {
            apiKey = null;
            docCookies.removeItem("radio-apikey");
            initWebSocket();
            alert("Invalid API key, might be expired");
        }
    }).catch(() => {
        apiKey = null;
        docCookies.removeItem("radio-apikey");
        initWebSocket();
        alert("Invalid API key, might be expired");
    });
}

function nickIdentify(username) {
    username = username.trim();
    if (username === "") {
        return;
    }
    document.querySelectorAll(".non-auth").forEach((e) => {
        e.classList.add("auth");
        e.classList.remove("non-auth");
    });
    document.querySelector("#current-nick").textContent = username;
    document.querySelector("#current-nick").setAttribute("href", baseApiUrl + "/player/favorites/" + username);
    document.querySelector("#user-login").style["display"] = "none";
    document.querySelector("#radio-favorite").style["display"] = "inline-block";


    document.querySelectorAll(".stream-link").forEach((e) => {
        const url = new URL(e.getAttribute("href"), location.protocol + '//' + document.domain + ':' + location.port + '/');
        url.searchParams.set("apikey", apiKey);
        e.setAttribute("href", url.href);
    });

    const playing = !uplayer.isPaused();

    const url = new URL(uplayer.currentUrl, baseApiUrl);
    url.searchParams.set("apikey", apiKey);

    uplayer.init(url, [audioStream.format]);

    if (playing) {
        uplayer.play();
    }

    //u("#link-favoriteplayer").attr("href", "/player/favorites/" + username);
    //u("#search-type").append('<option value="favorites">My Favorites</option>');
}

function initSearch() {
    document.querySelector("#search-query").addEventListener("keyup", function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(runQuery, searchTimeout);
    })
    document.querySelector("#search-query").addEventListener("keydown", function () {
        clearTimeout(searchTimer);
    });

    document.querySelector("#search-type").addEventListener("change", function () {
        if (this.value === "raw") {
            //u("#search-docs").first().style.display = "";
        } else {
            //u("#search-docs").first().style.display = "none";
        }

        runQuery(true);
    });
}

function runQuery(force) {
    clearTimeout(searchTimer);

    const username = document.querySelector("#current-nick").textContent.toLowerCase();

    if (username === "") {
        return;
    }

    let query = document.querySelector("#search-query").value.trim();

    const results = document.querySelector("#search-results");

    const type = document.querySelector("#search-type").value;

    if (query == "" && type != "favorites" && type != "history") {
        //TODO: clear list
        oldQuery = query;
        results.innerHTML = "";
        return;
    }

    let orderType = 'orderBy=score&orderDirection=desc&';
    if(type === 'album'){
        orderType = 'orderBy=albumPath&orderDirection=asc&'
    }

    if (type !== "raw" && type !== "history" && type !== "favorites") {
        query = type + "~\"" + query.replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0') + "\"";
    }

    if (query === oldQuery && force !== true) {
        return;
    }
    oldQuery = query;

    if (searchRequest !== null) {
        searchRequest.abort();
    }

    let requestUrl = null;
    if (type === "favorites" && query !== "") {
        requestUrl = "/api/search?orderBy=score&orderDirection=desc&q=" + encodeURIComponent("fav:\"" + username + "\" AND (" + query + ")");
    } else if (type === "favorites") {
        requestUrl = "/api/favorites/" + username;
    } else if (type === "history") {
        requestUrl = "/api/history?limit=20";
    } else {
        requestUrl = "/api/search?"+ orderType + "q=" + encodeURIComponent(query) + "&limit=100";
    }

    searchRequest = new AbortController();
    const currentType = type;
    apiRequest(requestUrl, "GET", searchRequest.signal).then((data) => {
        results.innerHTML = "";
        for (let i = 0; i < data.length; i++) {
            let entry = data[i];
            if (currentType === "history") {
                entry = entry["song"];
            }
            results.append(createResultsEntry(entry));
        }
        if (data.length === 0) {
            if (query.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/) === null) {
                results.textContent = "No results. Did you try searching in Japanese?";
            } else {
                results.textContent = "No results. Did you try searching in Romanji?";
            }
        }

        results.append(document.createElement("hr"));
        searchRequest = null;
    });
}


document.querySelector(".volume-slider").addEventListener("change", function () {
    window.localStorage.setItem("radio-volume", this.value);
});


findCompatibleAudioStreams();

const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

audioStream = null;
if (connection && (connection.effectiveType === "cellular" || connection.effectiveType === "bluetooth" || connection.saveData)) {
    //better data usage
    audioStream = selectAudioStream(["medium"]);
} else {
    audioStream = selectAudioStream(["high", "medium"]);
}


if (audioStream === null) {
    audioStream = compatibleAudioStreams[0];
}

let i;
if (window.localStorage.getItem("radio-stream-id") !== null) {
    compatibleAudioStreams.forEach((aStream) => {

    });
    for (i = 0; i < compatibleAudioStreams.length; ++i) {
        if (compatibleAudioStreams[i].id == window.localStorage.getItem("radio-stream-id")) {
            audioStream = compatibleAudioStreams[i];
            break;
        }
    }
}

let stream;
for (i = 0; i < compatibleAudioStreams.length; ++i) {
    stream = compatibleAudioStreams[i];
    let element = document.querySelector("#radio-quality-group-" + stream.quality);
    if (element.length === 0) {
        element = document.querySelector("#radio-quality");
    }

    const o = document.createElement("option");
    o.setAttribute("href", (new URL(stream.url, baseApiUrl)).href);
    o.value = stream.id;
    if(stream.id === audioStream.id){
        o.selected = true;
    }
    o.textContent = (stream.info.playbackType === "codec" ? stream.name + " (via codec" + (stream.info.powerEfficient ? "" : ", power-hungry") + ")" : stream.name + (stream.info.powerEfficient ? "" : ", power-hungry"));
    element.append(o);
}

for (i = 0; i < audioStreams.length; ++i) {
    stream = audioStreams[i];

    const a = document.createElement("a");
    a.setAttribute("href", (new URL(stream.url, baseApiUrl)).href);
    a.id = "stream-" + stream.id;
    a.classList.add("stream-link", "button");
    a.textContent = stream.name;
    document.querySelector("#streams-" + stream.quality).append(a);
}

console.log("Playing " + audioStream.quality + " - " + audioStream.name);
uplayer.init((new URL(audioStream.url, baseApiUrl)).href, [audioStream.format]);

if (docCookies.getItem("radio-apikey") !== null) {
    apiKeyIdentify(docCookies.getItem("radio-apikey"));
} else {
    initWebSocket();
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;

    if (window.localStorage.getItem("radio-skip-install") === "yes") {
        return;
    }

    document.querySelector("#install-webapp").classList.remove("hidden");
});

document.querySelector("#install-webapp").addEventListener("click", function () {
    if (deferredPrompt === null) {
        return;
    }
    document.querySelector("#install-webapp").classList.add("hidden");
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function (choiceResult) {
        if (choiceResult.outcome === 'accepted') {
            window.localStorage.setItem("radio-skip-install", "no");
        } else {
            window.localStorage.setItem("radio-skip-install", "yes");
        }
        deferredPrompt = null;
    });
});