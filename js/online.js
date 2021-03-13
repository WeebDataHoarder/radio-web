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

jQuery(document).ready(function () {
    /*
        When the window resizes, ensure the left and right side of the player
        are equal.
    */
    jQuery(window).on('resize', function () {
        //adjustPlayerHeights();
    });

    initWebsite();
});

function applyTagMeta(meta){
    if("dl-link-type" in meta){
        jQuery("#np-download").addClass(meta["dl-link-type"]);
    }
    if("dl-link-href" in meta){
        jQuery("#np-download").attr("href", meta["dl-link-href"]);
    }
}

const uplayer = new UPlayer({
    "limitCodecs": ["audio/flac", "audio/ogg;codecs=opus", "audio/mpeg;codecs=mp3", "audio/aac"],
    "volume": window.localStorage.getItem("radio-volume") !== null ? window.localStorage.getItem("radio-volume") / 100 : 1.0,
    "preload": false,
    "streaming": true,
    "muted": false,
    "retry": true,
    "play-pause-element": jQuery(".play-pause"),
    //"progress-minutes-element": jQuery(".radio-current-minutes"),
    //"progress-seconds-element": jQuery(".radio-current-seconds"),
    //"duration-minutes-element": jQuery(".radio-duration-minutes"),
    //"duration-seconds-element": jQuery(".radio-duration-seconds"),
    //"progress-element": jQuery(".radio-song-played-progress"),
    //"buffer-progress-element": jQuery(".radio-song-played-progress"),
    "mute-element": jQuery(".mute"),
    "volume-element": jQuery(".volume-slider"),
    "on-ready": function () {
        jQuery(".play-pause").removeClass("hidden");
    }
});

let audioStream;

function initWebsite() {
    jQuery("#radio-quality").on('change', function () {
        const playing = uplayer.isPlaying();

        for (let i = 0; i < compatibleAudioStreams.length; ++i) {
            if (compatibleAudioStreams[i].id == jQuery(this).val()) {
                audioStream = compatibleAudioStreams[i];
                break;
            }
        }

        window.localStorage.setItem("radio-stream-id", jQuery(this).val());

        uplayer.init(document.getElementById("stream-" + jQuery(this).val()).href, [audioStream.format]);
        if (playing) {
            uplayer.play();
        }
    });

    jQuery("#api-key").on('keypress', function (e) {
        if (e.which === 13) {
            apiKeyIdentify(jQuery(this).val());
        }
    });

    jQuery("#radio-skip").on('click', function () {
        if (listeners.num_listeners <= 2 || confirm("Are you sure you want to skip this track? You are (not) alone.")) {
            jQuery.ajax({
                type: "GET",
                url: baseApiUrl + "/api/skip"
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

        jQuery(".np-seconds").text(("" + (current % 60)).padStart(2, "0"));
        jQuery(".np-minutes").text(("" + Math.floor(current / 60)).padStart(2, "0"));
        jQuery(".np-duration-seconds").text(("" + (totalDuration % 60)).padStart(2, "0"));
        jQuery(".np-duration-minutes").text(("" + Math.floor(totalDuration / 60)).padStart(2, "0"));
        jQuery("#song-played-progress").attr("value", current / totalDuration);

    }, 200);

    if ("Notification" in window) {
        jQuery("#notify-check-group").css("display", "inline-block");
        if (Notification.permission === "granted" && window.localStorage.getItem("radio-notifications") == "on") {
            jQuery("#notify-check").prop("checked", true);
        }

        jQuery("#notify-check").on("change", function () {
            if (jQuery(this).prop("checked")) {
                Notification.requestPermission().then(function (result) {
                    if (result !== "granted") {
                        jQuery("#notify-check").prop("checked", false);
                    } else {
                        window.localStorage.setItem("radio-notifications", jQuery("#notify-check").prop("checked") ? "on" : "off");
                    }
                })
            } else {
                jQuery(this).prop("checked", false);
                window.localStorage.setItem("radio-notifications", "off");
            }
        });
    }

    jQuery("#radio-player").on('click', ".song-favorite", function () {
        const username = jQuery("#current-nick").text();
        const thisElement = this;
        if (username == "") {
            return;
        }

        jQuery.ajax(baseApiUrl + "/api/favorites/" + username + "/" + jQuery(this).attr("data-track-hash"), {
            method: jQuery(this).hasClass("favorited") ? "DELETE" : "PUT",
            async: true
        }).done(function (data, code, xhr) {
            /*if(xhr.status == 200 || xhr.status == 201){
                jQuery(thisElement).addClass("favorited");
            }*/
        });
    });

    jQuery("#search-results").on('mousedown', ".search-result-queue", function (a) {
        const target = jQuery(a.target);
        const songHash = jQuery(this).attr("data-track-hash");
        if (a.ctrlKey || (a.which == 2 || a.button == 2)) {
            window.open(baseApiUrl + "/player/hash/" + songHash, '_blank');
            a.stopImmediatePropagation();
            return;
        }
        if (target.hasClass("song-favorite")/* || target.hasClass("song-album") || target.hasClass("song-artist") || target.hasClass("song-title")*/) {
            return;
        }
        const thisElement = this;
        jQuery.ajax(baseApiUrl + "/api/request/" + songHash, {
            method: "GET",
            async: true
        }).done(function (data) {
            if (data.hash == songHash) {
                jQuery(thisElement).hide(400);
            }
        });
    });

    /*
     jQuery(".np-album").on('click', function(){
         jQuery("#search-query").val(jQuery(this).text());
         jQuery("#search-type").val("album");
         runQuery();
     });

     jQuery(".np-artist").on('click', function(){
         jQuery("#search-query").val(jQuery(this).text());
         jQuery("#search-type").val("artist");
         runQuery();
     });

     jQuery(".np-song").on('click', function(){
         jQuery("#search-query").val(jQuery(this).text());
         jQuery("#search-type").val("title");
         runQuery();
     });

     jQuery("#radio-player").on('click', ".song-album", function(){
         jQuery("#search-query").val(jQuery(this).text());
         jQuery("#search-type").val("album");
         runQuery();
     });

     jQuery("#radio-player").on('click', ".song-artist", function(){
         jQuery("#search-query").val(jQuery(this).text());
         jQuery("#search-type").val("artist");
         runQuery();
     });

     jQuery("#radio-player").on('click', ".song-title", function(){
         jQuery("#search-query").val(jQuery(this).text());
         jQuery("#search-type").val("title");
         runQuery();
     });
*/

    jQuery(".hash-area").on('click', function () {
        const temp = jQuery("<input>");
        jQuery("body").append(temp);
        temp.val(jQuery(this).text()).select();
        document.execCommand("copy");
        temp.remove();
    });

    jQuery("#search-queryrandom").on('click', function () {
        if (oldQuery == "") {
            return;
        }

        jQuery.ajax(baseApiUrl + "/api/request/random?q=" + encodeURIComponent(oldQuery));
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
        } else if (data.type == 'playing') {
            if(np != null){
                nr = null;
            }
            np = data.data;
            updateTrackData(np);
            updateQueueData(currentQueue);
        } else if (data.type == 'listeners') {
            listeners = data.data;
            if (listeners.num_listeners <= 2) {
                jQuery("#radio-skip").show(400);
            } else {
                jQuery("#radio-skip").hide(400);
            }
            //jQuery("#radio-listeners").first().innerHTML = data.data.num_listeners;
            if ("named_listeners" in data.data) {
                jQuery("#listeners").text("Listeners: " + (data.data.num_listeners - data.data.named_listeners.length) + " guest(s), " + data.data.named_listeners.join(", "));
            } else {
                jQuery("#listeners").text("Listeners: " + data.data.num_listeners + " guest(s)");
            }
        } else if (data.type == 'favorite') {
            const username = jQuery("#current-nick").text().toLowerCase();
            const targetElement = jQuery(".song-favorite[data-track-hash=\"" + data.data.song.hash + "\"]");
            if (targetElement.length === 0) {
                //No target on screen
            } else {
                if (data.data.user.toLowerCase() === username) {
                    if (data.data.action === "add") {
                        targetElement.addClass("favorited");
                    } else if (data.data.action === "remove") {
                        targetElement.removeClass("favorited");
                    }
                }
                targetElement.text(data.data.song.favored_by.length > 0 ? data.data.song.favored_by.length : "");
                targetElement.addClass("shake").on('animationend webkitAnimationEnd oAnimationEnd', function () {
                    targetElement.removeClass("shake");
                });
            }
        }
    };
}

function updateTrackData(data) {
    document.title = data.artist + " - " + data.title + " (" + data.album + ") :: anime(bits) #radio";
    jQuery(".np-artist").text(data.artist);
    jQuery(".np-album").text(data.album);
    jQuery(".np-song").text(data.title);
    if (data.hash) {
        jQuery(".np-hash").text(data.hash);
        jQuery("#radio-favorite").attr("data-track-hash", data.hash);
    }

    const username = jQuery("#current-nick").text();
    if ('favored_by' in data && username != "") {
        if (jQuery.inArray(username.toLowerCase(), data.favored_by) !== -1) {
            jQuery("#radio-favorite").addClass("favorited");
        } else {
            jQuery("#radio-favorite").removeClass("favorited");
        }
        jQuery("#radio-favorite").text(data.favored_by.length > 0 ? data.favored_by.length : "");
    }
    jQuery("#np-download").removeClass("ab");
    jQuery("#np-download").removeClass("jps");
    jQuery("#np-download").removeClass("red");
    jQuery("#np-download").removeClass("bbt");
    jQuery("#np-tags.tag-area").html("");

    let tagData = getTagEntries(data);
    applyTagEntries(jQuery("#np-tags.tag-area").get(0), tagData.tags);
    applyTagMeta(tagData.meta);

    if (data.hash) {
        jQuery("#np-player").attr("href", baseApiUrl + "/player/hash/" + data.hash);
    }
    let imageUrl;
    jQuery(".np-image").attr("src", imageUrl = (data.cover !== null ? '/api/cover/' + data.cover + '/large' : '/img/no-cover.jpg'));
    jQuery(".body-blur").css("background-image", "url("+ imageUrl +")");


    pushMediaSessionMetadata(data);


    if (uplayer.isPlaying()) {
        setTimeout(function () {
            pushPlayNotification(data, "np");
        }, 6000);
    }
}

function createQueueEntry(data, startTime = null) {
    const username = jQuery("#current-nick").text();
    return '' +
        '<div class="song radio-song-container">' +
        '<div class="queue-fit"><img class="queue-cover" src="' + (data.cover !== null ? '/api/cover/' + data.cover + '/small' : '/img/no-cover.jpg') + '" loading=lazy/></div>' +
        '<div class="song-now-playing-icon-container">' +
        ("random" in data && data.random ? '<img class="now-playing" src="/img/shuffle-on.svg"/>' : '') +
        ("random" in data && data.random ? '' : '<div class="now-playing song-favorite user-feature ' + ('favored_by' in data && jQuery.inArray(username.toLowerCase(), data.favored_by) !== -1 ? "favorited" : "") + '" data-track-hash="' + data.hash + '">' + ('favored_by' in data && data.favored_by.length > 0 ? data.favored_by.length : "") + '</div>') +
        '</div>' +
        '	<div class="song-meta-data">' +
        '		<span class="song-title">' + htmlentities(data.title) + '</span>' +
        '		<span class="song-artist">' + htmlentities(data.artist) + '</span>' +
        '		<span class="song-album">' + htmlentities(data.album) + '</span>' +
        '	</div>' +
        '	<span class="song-duration">' + (startTime !== null ? "in&nbsp;~" + Math.ceil((startTime - (Date.now() / 1000)) / 60) + "m" : ("" + Math.floor(data.duration / 60)).padStart(2, "0") + ':' + ("" + (data.duration % 60)).padStart(2, "0")) + '</span>' +
        '</div>';
}

function createResultsEntry(data) {
    const username = jQuery("#current-nick").text();
    return '' +
        '<div class="song radio-song-container search-result-queue" data-track-hash="' + data.hash + '">' +
        '<img class="queue-add" src="/img/add.svg"/>' +
        '<div class="queue-fit"><img class="queue-cover" src="' + (data.cover !== null ? '/api/cover/' + data.cover + '/small' : '/img/no-cover.jpg') + '" loading=lazy/></div>' +
        '<div class="song-now-playing-icon-container">' +
        '<div class="now-playing song-favorite user-feature ' + (jQuery.inArray(username.toLowerCase(), data.favored_by) !== -1 ? "favorited" : "") + '" data-track-hash="' + data.hash + '">' + (data.favored_by.length > 0 ? data.favored_by.length : "") + '</div>' +
        '</div>' +
        '	<div class="song-meta-data">' +
        '		<span class="song-title">' + htmlentities(data.title) + '</span>' +
        '		<span class="song-artist">' + htmlentities(data.artist) + '</span>' +
        '		<span class="song-album">' + htmlentities(data.album) + '</span>' +
        '	</div>' +
        '	<span class="song-duration">' + ("" + Math.floor(data.duration / 60)).padStart(2, "0") + ':' + ("" + (data.duration % 60)).padStart(2, "0") + '</span>' +
        '</div>';
}

function updateQueueData(res) {
    let queueDuration = np && 'started' in np ? np.started + np.duration : null;
    if (res.length == 0) {
        jQuery("#radio-queue").html("");
        if (nr !== null) {
            if (currentQueue.length != 0 || np.id == nr.id) {
                return;
            }
            jQuery("#radio-queue").append(createQueueEntry({
                "title": nr.title,
                "artist": nr.artist,
                "album": nr.album,
                "hash": nr.hash,
                "duration": nr.duration,
                "random": true,
                "cover": nr.cover,
            }, queueDuration));
        } else {

            jQuery("#radio-queue").append(createQueueEntry({
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
        jQuery("#radio-queue").html("");
        for (let i = 0; i < res.length; i++) {
            jQuery("#radio-queue").append(createQueueEntry(res[i], queueDuration));
            if (queueDuration !== null) {
                queueDuration += res[i].duration;
            }
        }
    }
}

function apiKeyIdentify(key) {
    apiKey = key;
    $.ajaxSetup({
        headers: {
            "Authorization": apiKey
        }
    });
    jQuery.ajax(baseApiUrl + "/api/user/info").done(function (data) {
        if (data.user) {
            docCookies.setItem("radio-apikey", apiKey, Infinity, "/", window.location.hostname, true);
            nickIdentify(data.user);
            initWebSocket();
        } else {
            $.ajaxSetup({});
            apiKey = null;
            docCookies.removeItem("radio-apikey");
            initWebSocket();
            alert("Invalid API key, might be expired");
        }
    }).fail(function (state) {
        if (state.readyState == 4 && state.status == 403) {
            $.ajaxSetup({});
            apiKey = null;
            docCookies.removeItem("radio-apikey");
            initWebSocket();
            alert("Invalid API key, might be expired");
        }
    });
}

function nickIdentify(username) {
    username = username.trim();
    if (username == "") {
        return;
    }
    jQuery(".non-auth").addClass("auth").removeClass("non-auth");
    jQuery("#current-nick").text(username).attr("href", baseApiUrl + "/player/favorites/" + username);
    jQuery("#user-login").css("display", "none");
    jQuery("#radio-favorite").css("display", "inline-block");


    jQuery(".stream-link").each(function () {
        const url = new URL(jQuery(this).attr("href"), location.protocol + '//' + document.domain + ':' + location.port + '/');
        url.searchParams.set("apikey", apiKey);
        jQuery(this).attr("href", url.href);
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
    jQuery("#search-query").on("keyup", function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(runQuery, searchTimeout);
    }).on("keydown", function () {
        clearTimeout(searchTimer);
    });

    jQuery("#search-type").on("change", function () {
        if (jQuery(this).val == "raw") {
            //u("#search-docs").first().style.display = "";
        } else {
            //u("#search-docs").first().style.display = "none";
        }

        runQuery(true);
    });
}

function runQuery(force) {
    clearTimeout(searchTimer);

    const username = jQuery("#current-nick").text();

    if (username === "") {
        return;
    }

    let query = jQuery("#search-query").val().trim();

    const results = jQuery("#search-results");

    const type = jQuery("#search-type").val();

    if (query == "" && type != "favorites" && type != "history") {
        //TODO: clear list
        oldQuery = query;
        results.html("");
        return;
    }

    let orderType = 'orderBy=score&orderDirection=desc&';
    if(type == 'album'){
        orderType = 'orderBy=albumPath&orderDirection=asc&'
    }

    if (type != "raw" && type != "history" && type != "favorites") {
        query = type + "~\"" + query.replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0') + "\"";
    }

    if (query == oldQuery && force !== true) {
        return;
    }
    oldQuery = query;

    if (searchRequest !== null) {
        searchRequest.abort();
    }

    let requestUrl = null;
    if (type == "favorites" && query != "") {
        requestUrl = "/api/search?orderBy=score&orderDirection=desc&q=" + encodeURIComponent("fav:\"" + username + "\" AND (" + query + ")");
    } else if (type == "favorites") {
        requestUrl = "/api/favorites/" + username;
    } else if (type == "history") {
        requestUrl = "/api/history?limit=20";
    } else {
        requestUrl = "/api/search?"+ orderType + "q=" + encodeURIComponent(query) + "&limit=100";
    }


    searchRequest = jQuery.ajax(baseApiUrl + requestUrl, {
        method: "GET",
        async: true
    }).done(function (data, status, xhr) {
        if (xhr.status >= 200 && xhr.status < 300) {
            results.html("");
            for (let i = 0; i < data.length; i++) {
                let entry = data[i];
                if (type == "history") {
                    entry = entry["song"];
                }
                results.append(createResultsEntry(entry));
            }
            if (data.length == 0) {
                if (query.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/) === null) {
                    results.html("No results. Did you try searching in Japanese?");
                } else {
                    results.html("No results. Did you try searching in Romanji?");
                }
            }

            results.append('<hr/>');
            searchRequest = null;
        }
    }.bind(type));

    /*if(res.length == 0){
        if(query.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/) === null){
            results.innerHTML = "No results. Did you try searching in Japanese?";
        }else{
            results.innerHTML = "No results. Did you try searching in Romanji?";
        }
    }*/
}


jQuery(".volume-slider").on("change", function () {
    window.localStorage.setItem("radio-volume", jQuery(this).val());
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
    let element = jQuery("#radio-quality-group-" + stream.quality);
    if (element.length == 0) {
        element = jQuery("#radio-quality");
    }
    element.append('<option value="' + stream.id + '" ' + (stream.id == audioStream.id ? " selected" : "") + '>' + (stream.info.playbackType == "codec" ? stream.name + " (via codec" + (stream.info.powerEfficient ? "" : ", power-hungry") + ")" : stream.name + (stream.info.powerEfficient ? "" : ", power-hungry")) + '</option>');
}

for (i = 0; i < audioStreams.length; ++i) {
    stream = audioStreams[i];
    jQuery("#streams-" + stream.quality).append('<a href="' + (new URL(stream.url, baseApiUrl)).href + '" id="stream-' + stream.id + '" class="stream-link button">' + stream.name + '</a>');
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

    jQuery("#install-webapp").removeClass("hidden");
});

jQuery("#install-webapp").on("click", function () {
    if (deferredPrompt === null) {
        return;
    }
    jQuery("#install-webapp").addClass("hidden");
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