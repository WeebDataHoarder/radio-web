var currentQueue = [];
var np = [];
var nr = null;
var listeners = [];

var searchRequest = null;
var searchTimer;
var searchTimeout = 500;
var oldQuery = "";
var socket = null;

$(document).ready(function () {
    /*
        When the window resizes, ensure the left and right side of the player
        are equal.
    */
    $(window).on('resize', function () {
        //adjustPlayerHeights();
    });

    initWebsite();
});

function initWebsite() {

    jQuery("#radio-quality").on('change', function () {
        var playing = uplayer.isPlaying();

        for (var i = 0; i < compatibleAudioStreams.length; ++i) {
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

        var totalDuration = np.duration;
        var currentDuration = Math.floor((new Date()).getTime() / 1000 - np.started);

        var current = Math.max(0, Math.min(totalDuration, currentDuration));

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
        var username = jQuery("#current-nick").text();
        var thisElement = this;
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
        var target = jQuery(a.target);
        var songHash = jQuery(this).attr("data-track-hash");
        if (a.ctrlKey || (a.which == 2 || a.button == 2)) {
            window.open(baseApiUrl + "/player/hash/" + songHash, '_blank');
            a.stopImmediatePropagation();
            return;
        }
        if (target.hasClass("song-favorite")/* || target.hasClass("song-album") || target.hasClass("song-artist") || target.hasClass("song-title")*/) {
            return;
        }
        var thisElement = this;
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
        var temp = jQuery("<input>");
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
    var socketUrl = new URL(baseApiUrl);
    socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    var fullUrl = socketUrl.href + '/api/events/basic';
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
        var data = JSON.parse(event.data);
        if (data.type == 'queue') {
            if (data.data.action == 'initial') {
                currentQueue = data.data.queue;
                updateQueueData(currentQueue);
            } else if (data.data.action == 'remove') {
                for (var i = 0; i < currentQueue.length; ++i) {
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
            var username = jQuery("#current-nick").text().toLowerCase();
            var targetElement = $(".song-favorite[data-track-hash=\"" + data.data.song.hash + "\"]");
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

    var username = jQuery("#current-nick").text();
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

    if ("tags" in data) {
        var groupId = null;
        var torrentId = null;
        var linkType = null;


        var catalog = null;

        var miscTags = [];
        var miscPriority = 100;
        var allowedMiscTags = {
            aotw: 1,
            op: 1,
            ed: 1
        };


        var classTags = [];
        var classPriority = 100;
        var allowedClassTags = {
            touhou: 1,
            vocaloid: 1,
            eurobeat: 1,
            symphogear: 3,
            soundtrack: 2,
            remix: 3,
            doujin: 4,
            drama: 4
        };


        var genreTags = [];
        var genrePriority = 100;
        var allowedGenreTags = {
            alternative: 1,
            house: 1,
            dance: 1,
            trance: 1,
            ambient: 1,
            electronic: 2,
            funk: 1,
            gothic: 1,
            jazz: 1,
            metal: 1,
            pop: 2,
            rock: 1,
            vocal: 1
        };
        for (var i = 0; i < data.tags.length; ++i) {
            var tag = data.tags[i];
            var matches = null;
            if ((matches = tag.match(/^(jps|ab|red|bbt)([gt])\-([0-9]+)$/i)) !== null) {
                if (matches[2] == "g") {
                    groupId = matches[3];
                } else if (matches[2] == "t") {
                    torrentId = matches[3];
                }
                linkType = matches[1];
            } else if ((matches = tag.match(/^catalog\-(.+)$/i)) !== null) {
                catalog = matches[1].toUpperCase();
            } else if (tag in allowedMiscTags) {
                if (allowedMiscTags[tag] === miscPriority) {
                    miscPriority = allowedMiscTags[tag];
                    miscTags.push(tag);
                } else if (allowedMiscTags[tag] < miscPriority) {
                    miscPriority = allowedMiscTags[tag];
                    miscTags = [];
                    miscTags.push(tag);
                }
            } else if (tag in allowedClassTags) {
                if (allowedClassTags[tag] === classPriority) {
                    classPriority = allowedClassTags[tag];
                    classTags.push(tag);
                } else if (allowedClassTags[tag] < classPriority) {
                    classPriority = allowedClassTags[tag];
                    classTags = [];
                    classTags.push(tag);
                }
            } else if (tag in allowedGenreTags) {
                if (allowedGenreTags[tag] === genrePriority) {
                    genrePriority = allowedGenreTags[tag];
                    genreTags.push(tag);
                } else if (allowedGenreTags[tag] < genrePriority) {
                    genrePriority = allowedGenreTags[tag];
                    genreTags = [];
                    genreTags.push(tag);
                }
            }
        }


        if (catalog !== null) {
            var targetSearch = "https://musicbrainz.org/search?advanced=1&type=release&query=" + encodeURIComponent("catno:" + catalog);
            if (data.tags.includes('touhou')) {
                targetSearch = "https://thwiki.cc/index.php?setlang=en&search=" + encodeURIComponent("incategory:同人专辑 (" + catalog + ")");
            } else if (data.tags.includes('soundtrack') || data.tags.includes('doujin') || data.tags.includes('remix') || data.tags.includes('op') || data.tags.includes('ed')) {
                targetSearch = "https://vgmdb.net/search?q=" + encodeURIComponent(catalog);
            } else if (data.tags.includes('vocaloid')) {
                targetSearch = "https://vocadb.net/Search?searchType=Album&filter=" + encodeURIComponent(catalog);
            } else if (data.tags.includes('eurobeat')) {
                targetSearch = "http://www.dancegroove.net/database/search.php?mode=cd&catalog=" + encodeURIComponent(catalog);
            } else if (data.tags.includes('pop')) {
                //targetSearch = "https://www.discogs.com/search/?type=release&catno=" + encodeURIComponent(catalog);
            }
            var newTag = $(document.createElement("div"));
            newTag.addClass("tag");
            newTag.addClass("tag-catalog-" + catalog);
            newTag.text(catalog);
            newTag.on('mousedown', function (a) {
                if (a.ctrlKey || (a.which == 2 || a.button == 2)) {
                    window.open(targetSearch, '_blank');
                    a.stopImmediatePropagation();
                    return;
                }
                var temp = jQuery("<input>");
                jQuery("body").append(temp);
                temp.val(jQuery(this).text()).select();
                document.execCommand("copy");
                temp.remove();
            });
            jQuery("#np-tags.tag-area").append(newTag);
        }

        for (var i = 0; i < classTags.length; ++i) {
            var newTag = $(document.createElement("div"));
            newTag.addClass("tag");
            newTag.addClass("tag-" + classTags[i]);
            newTag.text(classTags[i]);
            jQuery("#np-tags.tag-area").append(newTag);
        }

        for (var i = 0; i < genreTags.length; ++i) {
            var newTag = $(document.createElement("div"));
            newTag.addClass("tag");
            newTag.addClass("tag-" + genreTags[i]);
            newTag.text(genreTags[i]);
            jQuery("#np-tags.tag-area").append(newTag);
        }

        for (var i = 0; i < miscTags.length; ++i) {
            var newTag = $(document.createElement("div"));
            newTag.addClass("tag");
            newTag.addClass("tag-" + miscTags[i]);
            newTag.text(miscTags[i]);
            jQuery("#np-tags.tag-area").append(newTag);
        }

        if (groupId !== null && torrentId !== null && (linkType == "ab" || linkType == "jps" || linkType == "red" || linkType == "bbt")) {
            jQuery("#np-download").addClass(linkType);
            if (linkType == "ab") {
                jQuery("#np-download").attr("href", "https://animebytes.tv/torrents2.php?id=" + groupId + "&torrentid=" + torrentId);
            } else if (linkType == "jps") {
                jQuery("#np-download").attr("href", "https://jpopsuki.eu/torrents.php?id=" + groupId + "&torrentid=" + torrentId);
            } else if (linkType == "red") {
                jQuery("#np-download").attr("href", "https://redacted.ch/torrents.php?id=" + groupId + "&torrentid=" + torrentId);
            } else if (linkType == "bbt") {
                jQuery("#np-download").attr("href", "https://bakabt.me/torrent/" + torrentId + "/show");
            }
        } else {
            if (data.hash) {
                jQuery("#np-download").attr("href", baseApiUrl + "/api/download/" + data.hash);
            }
        }
    }


    if (data.hash) {
        jQuery("#np-player").attr("href", baseApiUrl + "/player/hash/" + data.hash);
    }
    jQuery(".np-image").css("background-image", "url(" + (data.cover !== null ? '/api/cover/' + data.cover + '/large' : '/img/no-cover.jpg') + ")");

    if ('mediaSession' in navigator) {

        navigator.mediaSession.metadata = new MediaMetadata({
            title: data.title,
            artist: data.artist,
            album: data.album,
            artwork: [
                {
                    src: location.protocol + '//' + document.domain + ':' + location.port + (data.cover !== null ? "/api/cover/" + data.cover + "/large" : "/img/no-cover.jpg"),
                    sizes: '800x800',
                    type: 'image/jpeg'
                },
                {
                    src: location.protocol + '//' + document.domain + ':' + location.port + (data.cover !== null ? "/api/cover/" + data.cover + "/small" : "/img/no-cover.jpg"),
                    sizes: '55x55',
                    type: 'image/jpeg'
                }
            ]
        });
    }


    if (jQuery("#notify-check").prop("checked") && Notification.permission === "granted" && uplayer.isPlaying()) {
        setTimeout(function () {
            var actions = [];
            var username = jQuery("#current-nick").text();
            /*if(username != "" && 'actions' in Notification.prototype && Notification.maxActions >= 3){
                if(jQuery.inArray(username.toLowerCase(), data.favored_by) !== -1){
                    actions.push({
                        action: 'unfavorite',
                        title: 'Favorited'
                    });
                }else{
                    actions.push({
                        action: 'favorite',
                        title: 'Favorite',
                        icon: '/img/heart.svg'
                    });
                }

                if('hash' in data){
                    actions.push({
                        action: 'player',
                        title: 'Open Player',
                        icon: '/img/external-player.svg'
                    });
                }

                if(listeners.num_listeners <= 2){
                    actions.push({
                        action: 'skip',
                        title: 'Skip',
                    });
                }
            }*/
            var n = new Notification(data.title + " by " + data.artist, {
                icon: (data.cover !== null ? '/api/cover/' + data.cover + '/small' : '/img/no-cover.jpg') + "?apikey=" + apiKey,
                image: (data.cover !== null ? '/api/cover/' + data.cover + '/large' : '/img/no-cover.jpg') + "?apikey=" + apiKey,
                body: "from " + data.album + ' [' + uplayer.zeroPad(Math.floor(data["duration"] / 60), 2) + ':' + uplayer.zeroPad(data["duration"] % 60, 2) + ']' + (('favored_by' in data && data.favored_by.length > 0) ? " Favorited " + data.favored_by.length + " time(s)." : ""),
                silent: true,
                requireInteraction: false,
                tag: "np.radio.animebits.moe",
                data: data,
                actions: actions
            });
            n.onclick = function(){
                window.focus();
            };
            /*
            n.addEventListener('notificationclick', function (event) {
                var data = event.notification.data;

                if (event.action === 'skip' && listeners.num_listeners <= 2) {
                    jQuery.ajax({
                        type: "GET",
                        url: baseApiUrl + "/api/skip"
                    });
                    event.notification.close();
                } else if (event.action === 'favorite') {
                    jQuery.ajax(baseApiUrl + "/api/favorites/" + username + "/" + data.hash, {
                        method: "PUT",
                        async: true
                    }).done(function (data, code, xhr) {
                        event.notification.close();
                    });
                } else if (event.action === 'player') {
                    clients.openWindow("/player/hash/" + data.hash.substring(0, 12));
                    event.notification.close();
                } else {
                    parent.focus();
                    window.focus();
                    event.notification.close();
                }
            }, false);*/
            setTimeout(n.close.bind(n), 30000);
        }, 6000);
    }
}

function createQueueEntry(data, startTime = null) {
    var username = jQuery("#current-nick").text();
    return '' +
        '<div class="song radio-song-container">' +
        '<img class="queue-cover" style="background-image:url(' + (data.cover !== null ? '/api/cover/' + data.cover + '/small' : '/img/no-cover.jpg') + ')"/>' +
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

function htmlentities(rawStr) {
    return String(rawStr).replace(/[\u00A0-\u9999<>\&]/gim, function (i) {
        return '&#' + i.charCodeAt(0) + ';';
    });
}

function createResultsEntry(data) {
    var username = jQuery("#current-nick").text();
    return '' +
        '<div class="song radio-song-container search-result-queue" data-track-hash="' + data.hash + '">' +
        '<img class="queue-add" src="/img/add.svg"/>' +
        '<img class="queue-cover" style="background-image:url(' + (data.cover !== null ? '/api/cover/' + data.cover + '/small' : '/img/no-cover.jpg') + '"/>' +
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
    var queueDuration = np && 'started' in np ? np.started + np.duration : null;
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
        for (var i = 0; i < res.length; i++) {
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
            docCookies.setItem("radio-apikey", apiKey, Infinity, "/", "radio.animebits.moe", true);
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
    jQuery(".non-auth").addClass("auth");
    jQuery(".non-auth").removeClass("non-auth");
    jQuery("#current-nick").text(username);
    jQuery("#current-nick").attr("href", baseApiUrl + "/player/favorites/" + username);
    jQuery("#user-login").css("display", "none");
    jQuery("#radio-favorite").css("display", "inline-block");


    jQuery(".stream-link").each(function () {
        var url = new URL(jQuery(this).attr("href"), location.protocol + '//' + document.domain + ':' + location.port + '/');
        url.searchParams.set("apikey", apiKey);
        jQuery(this).attr("href", url.href);
    });

    var playing = !uplayer.isPaused();

    var url = new URL(uplayer.currentUrl, baseApiUrl);
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
    });
    jQuery("#search-query").on("keydown", function () {
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

    var username = jQuery("#current-nick").text();

    if (username == "") {
        return;
    }

    var query = jQuery("#search-query").val().trim();

    var results = jQuery("#search-results");

    var type = jQuery("#search-type").val();

    if (query == "" && type != "favorites" && type != "history") {
        //TODO: clear list
        oldQuery = query;
        results.html("");
        return;
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

    var requestUrl = null;
    if (type == "favorites" && query != "") {
        requestUrl = "/api/search?q=" + encodeURIComponent("fav:\"" + username + "\" AND (" + query + ")");
    } else if (type == "favorites") {
        requestUrl = "/api/favorites/" + username;
    } else if (type == "history") {
        requestUrl = "/api/history?limit=20";
    } else {
        requestUrl = "/api/search?q=" + encodeURIComponent(query) + "&limit=100";
    }


    searchRequest = jQuery.ajax(baseApiUrl + requestUrl, {
        method: "GET",
        async: true
    }).done(function (data, status, xhr) {
        if (xhr.status >= 200 && xhr.status < 300) {
            results.html("");
            for (var i = 0; i < data.length; i++) {
                var entry = data[i];
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
