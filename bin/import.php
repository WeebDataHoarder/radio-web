<?php

require_once("common.php");

$key = getAuthenticationKey();
if ($key === null) {
    header('HTTP/1.1 403 Forbidden');
    echo("You need to authenticate on main page before using the Favorite Import service");
    exit();
}

$dbconn = connectToMusicDatabase();
if ($dbconn === null) {
    exit();
}

$user = checkAuthenticationKey($dbconn, $key);
if ($user === null) {
    header('HTTP/1.1 403 Forbidden');
    echo("You need to authenticate on main page before using the Favorite Import service");
    exit();
}

?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="no-referrer">
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <title>anime(bits) #radio :: Import favorites</title>

    <script type="text/javascript" src="/js/jquery.js?<?php echo VERSION_HASH; ?>"
            nonce="<?php echo SCRIPT_NONCE; ?>"></script>
    <script type="text/javascript" src="/js/player/aurora.js?<?php echo VERSION_HASH; ?>"
            nonce="<?php echo SCRIPT_NONCE; ?>"></script>
    <script type="text/javascript" src="/js/player/codecs/aac.js?<?php echo VERSION_HASH; ?>"
            nonce="<?php echo SCRIPT_NONCE; ?>" async></script>
    <script type="text/javascript" src="/js/player/codecs/alac.js?<?php echo VERSION_HASH; ?>"
            nonce="<?php echo SCRIPT_NONCE; ?>" async></script>
    <script type="text/javascript" src="/js/player/codecs/flac.js?<?php echo VERSION_HASH; ?>"
            nonce="<?php echo SCRIPT_NONCE; ?>" async></script>
    <script type="text/javascript" src="/js/player/codecs/mp3.js?<?php echo VERSION_HASH; ?>"
            nonce="<?php echo SCRIPT_NONCE; ?>" async></script>
    <script type="text/javascript" src="/js/player/codecs/ogg.js?<?php echo VERSION_HASH; ?>"
            nonce="<?php echo SCRIPT_NONCE; ?>" async></script>
    <script type="text/javascript" src="/js/player/codecs/opus.js?<?php echo VERSION_HASH; ?>"
            nonce="<?php echo SCRIPT_NONCE; ?>" async></script>
    <script type="text/javascript" src="/js/player/codecs/vorbis.js?<?php echo VERSION_HASH; ?>"
            nonce="<?php echo SCRIPT_NONCE; ?>" async></script>
    <script type="text/javascript" src="/js/player/codecs/tta.js?<?php echo VERSION_HASH; ?>"
            nonce="<?php echo SCRIPT_NONCE; ?>" async></script>
    <script type="text/javascript" src="/js/csv.min.js?<?php echo VERSION_HASH; ?>" nonce="<?php echo SCRIPT_NONCE; ?>"
            async></script>
    <script type="text/javascript" src="/js/md5asm.js?<?php echo VERSION_HASH; ?>" nonce="<?php echo SCRIPT_NONCE; ?>"
            async></script>
    <style type="text/css">
        #file-picker {
            font-size: 125%;
        }

        #file-picker input {
            font-size: 100%;
        }

        .track-entry {
            min-width: 600px;
        }

        .track-entry > .path-entry {
            font-weight: bold;
        }

        .track-entry > .hash-entry {
            margin-right: 10px;
        }

        .track-entry .hash-entry, .track-entry .path-entry {
            font-family: "Courier New", Courier, monospace;
        }

        .metadata-entry .metadata-title-entry, .metadata-entry .metadata-artist-entry, .metadata-entry .metadata-album-entry {
            font-weight: bold;
        }

        .results-entry .track-entry {
            cursor: pointer;
            padding: 2px;
        }

        .results-entry .track-entry:hover {
            border: 1px dashed #666;
        }

        .track-entry.progress-success {
            background: rgba(46, 204, 113, 0.2)
        }

        .track-entry.progress-search {
            background: rgba(197, 239, 247, 0.2)
        }

        .track-entry.track-favorited {
            background: rgba(255, 255, 204, 0.7)
        }

        .track-entry.progress-error {
            background: rgba(246, 36, 89, 0.2)
        }

        .metadata-meta-area {
            display: inline-block;
        }

        .metadata-cover-area {
            width: 40px;
            height: 40px;
            border: none;
            background-position: 50% 50%;
            background-repeat: no-repeat;
            background-size: contain;
            display: inline-block;
            vertical-align: top;
            margin-right: 5px;
        }

    </style>
</head>
<body>
<h1>anime(bits) #radio :: Import favorites</h1>
<p>In this page you can search for files you have, and find and import them into your favorites.</p>
<p>Current containers supported: .flac, .ogg (Opus / Vorbis). .m4a (AAC, ALAC), .mp3, .wav, .tta and other(s).</p>
<p>It will try to find matches using direct hashing, filename and size, or direct metadata embedded on file.</p>
<p>No file data is uploaded and they are only processed locally on your browser. It will then use the search API
    directly to find matches. Results will be listed when finished, click an entry to add it to your favorites.</p>
<p id="file-picker">
    <label>Tracks to search (media file) <input type="file" id="tracks-input"
                                                accept=".flac,.ogg,.opus,.m4a,.alac,.caf,.mp3,.wav,.wave,.tta,.aiff,.aif"
                                                multiple/></label>
    <br>
    <label>Do hash search (useless if you edited tags or re-encoded it) <input type="checkbox" id="do-hash"
                                                                               checked/></label> :: <label>Load and
        extract metadata <input type="checkbox" id="do-metadata" checked/></label>
</p>
<hr>
<p id="text-picker">
    If you don't want to submit files or don't have access to them locally, you can submit a .csv (with each column
    named an entry) or .json (with a list of objects that contain these entries) file with any of these entries (more
    will give better, quicker matches):
<ul>
    <li><b>hash</b>: MD5 file hash (done over whole raw file, useless if you edited tags).</li>
    <li><b>path</b>: Either the filename or full path of file (can be relative, for example <em>Artist/Album/01.
            Track.mp3</em>). Using original release names will give better results.
    </li>
    <li><b>size</b>: File size.</li>
    <li><b>title</b>: Track title.</li>
    <li><b>artist</b>: Track artist (use AnimeBytes values if possible).</li>
    <li><b>album_artist</b>: If different from <em>artist</em>.</li>
    <li><b>album</b>: Track album (use AnimeBytes values if possible).</li>
    <li><b>duration</b>: Track duration (in seconds).</li>
</ul>
<br>
It also supports JSON favorite extracts from listen.moe.
<br>
<label>Tracks to search (.csv, .json) <input type="file" id="tracks-text" accept=".csv,.json,.js,.txt"/></label>
</p>
<hr>
<div id="tracks-list"></div>
</body>
<script type="text/javascript" nonce="<?php echo SCRIPT_NONCE; ?>">

    window.trackEntries = [];
    var username = <?php echo json_encode($user["name"]); ?>;

    function addTrackToFavorites() {
        var thisElement = this;
        jQuery.ajax("/api/favorites/" + username + "/" + jQuery(this).attr("data-track-hash"), {
            method: "PUT",
            async: true
        }).done(function (data, code, xhr) {
            if (xhr.status == 200 || xhr.status == 201) {
                jQuery(thisElement).hide(400);
            }
        });
    }

    function createTrackEntry(i) {
        var trackEntry = document.createElement("div");
        trackEntries[i].element = trackEntry;
        $(trackEntry).attr("id", "track-" + i);
        $(trackEntry).addClass("track-entry");

        var coverArea = document.createElement("div");
        $(coverArea).addClass("metadata-cover-area");
        $(trackEntry).append(coverArea);

        var metaArea = document.createElement("div");
        $(metaArea).addClass("metadata-meta-area");
        $(trackEntry).append(metaArea);

        var hashEntry = document.createElement("a");
        $(hashEntry).addClass("hash-entry");
        $(metaArea).append(hashEntry);
        $(metaArea).append("::");

        var pathEntry = document.createElement("code");
        $(pathEntry).addClass("path-entry");
        $(metaArea).append(pathEntry);
        $(metaArea).append("<br/>");

        var metadataEntry = document.createElement("div");
        $(metadataEntry).addClass("metadata-entry");
        $(metaArea).append(metadataEntry);
        $(metaArea).append("<br/>");

        var titleEntry = document.createElement("span");
        $(titleEntry).addClass("metadata-title-entry");
        $(metadataEntry).append(titleEntry);
        $(metadataEntry).append(" from ");

        var albumEntry = document.createElement("span");
        $(albumEntry).addClass("metadata-album-entry");
        $(metadataEntry).append(albumEntry);
        $(metadataEntry).append(" by ");

        var artistEntry = document.createElement("span");
        $(artistEntry).addClass("metadata-artist-entry");
        $(metadataEntry).append(artistEntry);

        $(metadataEntry).append(" - ");

        var durationEntry = document.createElement("span");
        $(durationEntry).addClass("metadata-duration-entry");
        $(metadataEntry).append(durationEntry);

        var resultsEntry = document.createElement("ul");
        $(resultsEntry).addClass("results-entry");
        $(trackEntry).append(resultsEntry);

        updateTrackEntry(i);

        $("#tracks-list").append(trackEntry);
    }

    function createResultEntry(i, song) {
        var resultEntry = document.createElement("li");
        $(resultEntry).addClass("track-entry");
        $(resultEntry).attr("data-track-hash", song.hash);
        if (!song.favored_by.includes(username)) {
            $(resultEntry).on("click", addTrackToFavorites);
        } else {
            $(resultEntry).addClass("track-favorited");
        }

        var coverArea = document.createElement("div");
        $(coverArea).addClass("metadata-cover-area");
        if (song.cover !== null) {
            $(coverArea).css("background-image", "url(/api/cover/" + song.cover + "/small)");
        }
        $(resultEntry).append(coverArea);

        var metaArea = document.createElement("div");
        $(metaArea).addClass("metadata-meta-area");
        $(resultEntry).append(metaArea);

        var hashEntry = document.createElement("code");
        $(hashEntry).addClass("hash-entry");
        $(hashEntry).text(song.hash.substring(0, 12));
        $(metaArea).append(hashEntry);
        $(metaArea).append("::");

        var pathEntry = document.createElement("code");
        $(pathEntry).addClass("path-entry");
        $(pathEntry).text(song.path.substr(song.path.lastIndexOf('/') + 1));
        $(metaArea).append(pathEntry);

        var metadataEntry = document.createElement("div");
        $(metadataEntry).addClass("metadata-entry");
        $(metaArea).append(metadataEntry);

        var titleEntry = document.createElement("span");
        $(titleEntry).addClass("metadata-title-entry");
        $(titleEntry).text(song.title);
        if (song.favored_by.length > 0) {
            $(titleEntry).text(song.favored_by.length + " ❤︎ :: " + song.title);
        } else {
            $(titleEntry).text(song.title);
        }
        $(metadataEntry).append(titleEntry);
        $(metadataEntry).append(" from ");

        var albumEntry = document.createElement("span");
        $(albumEntry).addClass("metadata-album-entry");
        $(albumEntry).text(song.album);
        $(metadataEntry).append(albumEntry);
        $(metadataEntry).append(" by ");

        var artistEntry = document.createElement("span");
        $(artistEntry).addClass("metadata-artist-entry");
        $(artistEntry).text(song.artist);
        $(metadataEntry).append(artistEntry);

        $(metadataEntry).append(" ");

        var durationEntry = document.createElement("span");
        $(durationEntry).addClass("metadata-duration-entry");
        var seconds = ("" + (song.duration % 60)).padStart(2, "0");
        var minutes = ("" + Math.floor(song.duration / 60)).padStart(2, "0");
        $(durationEntry).text("[" + minutes + ":" + seconds + "]");
        $(metadataEntry).append(durationEntry);


        $(trackEntries[i].element).find(".results-entry").append(resultEntry);
    }

    function updateTrackEntry(i) {
        var trackEntry = trackEntries[i];
        if (trackEntry.hash !== null) {
            $(trackEntry.element).find(".hash-entry").text(trackEntry.hash.substring(0, 12));
        }
        if (trackEntry.path !== null) {
            $(trackEntry.element).find(".path-entry").text(trackEntry.path);
        }
        if (trackEntry.coverArt !== null) {
            $(trackEntry.element).find(".metadata-cover-area").css("background-image", "url(" + trackEntry.coverArt + ")");
        }
        if (trackEntry.title !== null) {
            $(trackEntry.element).find(".metadata-title-entry").text(trackEntry.title);
        }
        if (trackEntry.album !== null) {
            $(trackEntry.element).find(".metadata-album-entry").text(trackEntry.album);
        }
        if (trackEntry.artist !== null) {
            $(trackEntry.element).find(".metadata-artist-entry").text(trackEntry.artist);
        }
        if (trackEntry.duration !== null) {
            var seconds = ("" + (trackEntry.duration % 60)).padStart(2, "0");
            var minutes = ("" + Math.floor(trackEntry.duration / 60)).padStart(2, "0");
            $(trackEntry.element).find(".metadata-duration-entry").text("[" + minutes + ":" + seconds + "]");
        }
    }

    function resetSearch() {
        $("#tracks-list").html("");
        trackEntries = [];
    }

    function doHashCheck() {
        return $("#do-hash").prop("checked");
    }

    function doMetadataCheck() {
        return $("#do-metadata").prop("checked");
    }

    function addFileToList(file) {
        return new Promise((resolve, reject) => {
            var index = trackEntries.push({
                "hash": null,
                "file": file,
                "path": file.name.substr(file.name.lastIndexOf('/') + 1),
                "size": file.size,
                "title": null,
                "artist": null,
                "album_artist": null,
                "album": null,
                "duration": null,
                "progress": 0,
                "coverArt": null,
            }) - 1;
            prepareEntry(index).then(function () {
                resolve(index);
            }).catch(function (e) {
                reject(index, e);
            });
        });
    }

    function addRawEntryToList(entry) {
        return new Promise((resolve, reject) => {
            var index = trackEntries.push({
                "hash": entry.hash ? entry.hash : null,
                "file": null,
                "path": entry.path ? entry.path.substr(entry.path.lastIndexOf('/') + 1) : null,
                "size": entry.size ? entry.size : null,
                "title": entry.title ? entry.title : null,
                "artist": entry.artist ? entry.artist : null,
                "album_artist": entry.album_artist ? entry.album_artist : null,
                "album": entry.album ? entry.album : null,
                "duration": entry.duration ? entry.duration : null,
                "progress": 0,
                "coverArt": null
            }) - 1;
            createTrackEntry(index);

            resolve(index);
        });
    }

    function prepareEntry(index) {
        return new Promise((resolve, reject) => {
            createTrackEntry(index);

            if (doHashCheck()) {
                trackEntries[index].progress |= 0x01;
                hashFile(index).then(e => {
                    trackEntries[index].progress &= ~0x01;
                    if (trackEntries[index].progress === 0) {
                        resolve();
                    }
                }).catch(e => {
                    trackEntries[index].progress &= ~0x01;
                    trackEntries[index].hash = null;
                    reject(e);
                });
            }
            if (doMetadataCheck()) {
                trackEntries[index].progress |= 0x02;
                loadFileMetadata(index).then(e => {
                    trackEntries[index].progress &= ~0x02;
                    if (trackEntries[index].progress === 0) {
                        resolve();
                    }
                }).catch(e => {
                    trackEntries[index].progress &= ~0x02;
                    reject(e);
                });
            }

            if (trackEntries[index].progress === 0) {
                resolve();
            }
        });
    }

    function loadFileMetadata(index) {
        return new Promise((resolve, reject) => {
            var trackEntry = trackEntries[index];
            if (trackEntry.file === null) {
                resolve();
                return;
            }
            var asset = AV.Asset.fromFile(trackEntry.file);
            asset.get("duration", function (duration) {
                trackEntry.duration = Math.floor(duration / 1000);
                updateTrackEntry(index);
                if (trackEntry.album !== null || trackEntry.title !== null) {
                    resolve();
                }
            });
            asset.get("metadata", function (metadata) {
                if (metadata.album) {
                    trackEntry.album = metadata.album.replace(/\u0000/g, '');
                }
                if (metadata.albumartist) {
                    trackEntry.album_artist = metadata.albumartist.replace(/\u0000/g, '');
                }
                if (metadata.artist) {
                    trackEntry.artist = metadata.artist.replace(/\u0000/g, '');
                }
                if (metadata.title) {
                    trackEntry.title = metadata.title.replace(/\u0000/g, '');
                }
                if (metadata.coverArt) {
                    var blob = new Blob([metadata.coverArt.data], {type: 'image/jpeg'});
                    trackEntry.coverArt = URL.createObjectURL(blob);
                }
                updateTrackEntry(index);
                if (trackEntry.duration !== null) {
                    resolve();
                }
            });
            asset.on("error", (e) => {
                reject(e);
            });
        });
    }

    function doSearch(query) {
        return new Promise((resolve, reject) => {
            let url = new URL("/api/search", document.location.origin);
            url.searchParams.append("q", query);
            url.searchParams.append("limit", 500);

            fetch(url, {
                credentials: "same-origin",
                method: "GET"
            })
                .then(response => {
                    response.json()
                        .then(data => {
                            resolve(data);
                        })
                        .catch(reason => {
                            reject("Error decoding JSON: " + reason);
                        });
                })
                .catch(reason => {
                    reject("Error fetching data: " + reason);
                });
        });
    }

    function doSearchOperations(index) {
        return new Promise((resolve, reject) => {
            var trackEntry = trackEntries[index];
            let queryGroups = [];
            if (doHashCheck() && trackEntry.hash !== null && /^[a-f0-9]{32}$/.test(trackEntry.hash)) {
                queryGroups.push("hash=\"" + trackEntry.hash + "\"");
            }
            /*
            if(trackEntry.duration !== null && trackEntry.title !== null && trackEntry.path !== null){
                queryGroups.push("duration<"+(trackEntry.duration + 1)+" AND duration>"+(trackEntry.duration - 1)+" AND (title=\""+escapeQuotes(trackEntry.title)+"\" OR path=\"%/"+escapeQuotes(trackEntry.path)+"\")");
            }else if(trackEntry.duration !== null && trackEntry.path !== null){
                queryGroups.push("duration<"+(trackEntry.duration + 1)+" AND duration>"+(trackEntry.duration - 1)+" AND (path=\"%/"+escapeQuotes(trackEntry.path)+"\")");
            }else if(trackEntry.duration !== null && trackEntry.title !== null){
                queryGroups.push("duration<"+(trackEntry.duration + 1)+" AND duration>"+(trackEntry.duration - 1)+" AND (title=\""+escapeQuotes(trackEntry.title)+"\")");
            }*/
            if (doMetadataCheck()) {
                if (trackEntry.duration !== null) {
                    queryGroups.push(
                        "duration<" + (trackEntry.duration + 3) + " AND duration>" + (trackEntry.duration - 3) +
                        " AND (title=\"" + escapeQuotes(trackEntry.title !== null ? trackEntry.title : "[Unknown Title]") + "\"" +
                        " OR path=\"%/" + escapeQuotes(trackEntry.path !== null ? trackEntry.path : "[Unknown Path]") + "\"" +
                        " OR artist=\"%/" + escapeQuotes(trackEntry.artist !== null ? trackEntry.artist : "[Unknown Artist]") + "\"" +
                        " OR artist=\"%/" + escapeQuotes(trackEntry.album_artist !== null ? trackEntry.album_artist : "[Unknown Artist]") + "\"" +
                        " OR album=\"%/" + escapeQuotes(trackEntry.album !== null ? trackEntry.album : "[Unknown Album]") + "\"" +
                        ")"
                    );
                    queryGroups.push(
                        "duration<" + (trackEntry.duration + 3) + " AND duration>" + (trackEntry.duration - 3) +
                        " AND (title:\"" + escapeQuotes(trackEntry.title !== null ? trackEntry.title : "[Unknown Title]") + "\"" +
                        " OR path=\"%/" + escapeQuotes(trackEntry.path !== null ? trackEntry.path : "[Unknown Path]") + "\"" +
                        " OR artist:\"%/" + escapeQuotes(trackEntry.artist !== null ? trackEntry.artist : "[Unknown Artist]") + "\"" +
                        " OR artist:\"%/" + escapeQuotes(trackEntry.album_artist !== null ? trackEntry.album_artist : "[Unknown Artist]") + "\"" +
                        " OR album:\"%/" + escapeQuotes(trackEntry.album !== null ? trackEntry.album : "[Unknown Album]") + "\"" +
                        ")"
                    );
                    queryGroups.push(
                        "duration<" + (trackEntry.duration + 4) + " AND duration>" + (trackEntry.duration - 4) +
                        " AND (" +
                        (trackEntry.title !== null ? "(" + escapeParenthesis(trackEntry.title) + ") OR " : "") +
                        (trackEntry.artist !== null ? "(" + escapeParenthesis(trackEntry.artist) + ") OR " : "") +
                        (trackEntry.album_artist !== null ? "(" + escapeParenthesis(trackEntry.album_artist) + ") OR " : "") +
                        (trackEntry.album !== null ? "(" + escapeParenthesis(trackEntry.album) + ") OR " : "") +
                        "hash=00000000000000000000000000000000)" +
                        ")"
                    );
                } else if (trackEntry.title !== null) {
                    queryGroups.push(
                        "(title=\"" + escapeQuotes(trackEntry.title) + "\"" +
                        (trackEntry.path !== null ? " AND path=\"%/" + escapeQuotes(trackEntry.path) + "\"" : "") +
                        (trackEntry.artist !== null ? " AND artist=\"%/" + escapeQuotes(trackEntry.artist) + "\"" : "") +
                        (trackEntry.album_artist !== null ? " AND artist=\"%/" + escapeQuotes(trackEntry.album_artist) + "\"" : "") +
                        (trackEntry.album !== null ? " AND album=\"%/" + escapeQuotes(trackEntry.album) + "\"" : "") +
                        ")"
                    );

                    queryGroups.push(
                        "(title:\"" + escapeQuotes(trackEntry.title) + "\"" +
                        (trackEntry.path !== null ? " AND path:\"%/" + escapeQuotes(trackEntry.path) + "\"" : "") +
                        (trackEntry.artist !== null ? " AND artist:\"%/" + escapeQuotes(trackEntry.artist) + "\"" : "") +
                        (trackEntry.album_artist !== null ? " AND artist:\"%/" + escapeQuotes(trackEntry.album_artist) + "\"" : "") +
                        (trackEntry.album !== null ? " AND album:\"%/" + escapeQuotes(trackEntry.album) + "\"" : "") +
                        ")"
                    );
                }
            }

            if (queryGroups.length === 0) {
                resolve([])
                return;
            }

            handleSearch(resolve, reject, trackEntry, queryGroups, 0);
        });
    }

    function clearNameForMatch(name) {
        if (typeof name !== 'string') {
            return "";
        }
        return name.normalize().toLowerCase().replace(/[:\'\"\-~ \.\[\]\(\)_\#�\?\!\/;\+=\*]/g, '').replace(/(part|cd|disc|box|ost|cdbox)[0-9i]+/u, '').replace(/(original|complete)?soundtrack[0-9i]*/u, '');
    }

    function handleSearch(resolve, reject, trackEntry, queryGroups, currentIndex) {
        doSearch(queryGroups[currentIndex]).then((data) => {
            let results = [];
            var title1 = clearNameForMatch(trackEntry.title);
            var album1 = clearNameForMatch(trackEntry.album);
            var artist1 = clearNameForMatch(trackEntry.artist);
            var album_artist1 = clearNameForMatch(trackEntry.album_artist);
            var path1 = clearNameForMatch(trackEntry.path);

            for (let i = 0; i < data.length; ++i) {
                let t = data[i];
                if (t.hash === trackEntry.hash) {
                    results.unshift(t);
                    break;
                }
                var title2 = clearNameForMatch(t.title);
                var album2 = clearNameForMatch(t.album);
                var artist2 = clearNameForMatch(t.artist);
                var path2 = t.path.substr(t.path.lastIndexOf('/') + 1);
                if (
                    album1 === album2
                    || artist1 === artist2
                    || album_artist1 === artist2
                    || path1 === path2
                    || album1.indexOf(album2) > -1
                    || album2.indexOf(album1) > -1
                    || artist1.indexOf(artist2) > -1
                    || artist2.indexOf(artist1) > -1
                    || album_artist1.indexOf(artist2) > -1
                    || artist2.indexOf(album_artist1) > -1
                    || path1.indexOf(path2) > -1
                    || path2.indexOf(path1) > -1
                ) {
                    if (title1 === title2) {
                        results.unshift(t);
                    } else if (
                        title1.indexOf(title2) > -1
                        || title2.indexOf(title1) > -1
                    ) {
                        results.push(t);
                    }
                }
            }

            if (results.length > 0) {
                resolve(results);
            } else {
                if ((currentIndex + 1) < queryGroups.length) {
                    handleSearch(resolve, reject, trackEntry, queryGroups, currentIndex + 1);
                } else {
                    resolve([]);
                }
            }
        }).catch((e) => {
            if ((currentIndex + 1) < queryGroups.length) {
                handleSearch(resolve, reject, trackEntry, queryGroups, currentIndex + 1);
            } else {
                reject(e);
            }
        });
    }

    function escapeQuotes(str) {
        return str.replace(/\\([\s\S])|(")/g, "\\$1$2");
    }

    function escapeParenthesis(str) {
        return str.replace(/\\([\s\S])|([\(\)])/g, "\\$1$2");
    }

    function hashFile(index) {
        return new Promise((resolve, reject) => {
            var trackEntry = trackEntries[index];
            if (trackEntry.file === null) {
                resolve(null);
                return;
            }
            trackEntry.hash = "hashing 0%";
            updateTrackEntry(index);

            var fileSize = trackEntry.file.size;
            var chunkSize = 0x10000; // bytes
            var md5_ctx = md5_init();
            var offset = 0;
            var self = this; // we need a reference to the current object
            var chunkReaderBlock = null;
            var lastProgress = 0;

            var readEventHandler = function (evt) {
                if (md5_ctx === null) {
                    reject();
                    //????
                    return;
                }
                if (evt.target.error == null) {
                    offset += evt.target.result.byteLength;
                    var dataPtr = MD5Module._malloc(evt.target.result.byteLength);
                    var dataHeap = new Uint8Array(MD5Module.HEAPU8.buffer, dataPtr, evt.target.result.byteLength);
                    dataHeap.set(new Uint8Array(evt.target.result));
                    try {
                        md5_update(md5_ctx, dataHeap.byteOffset, dataHeap.byteLength);
                    } catch (e) {
                        md5_free(md5_ctx);
                        md5_ctx = null;
                        trackEntry.hash = "error";
                        updateTrackEntry(index);
                        console.log("Hash error: ");
                        console.log(e);
                        reject();
                    } finally {
                        MD5Module._free(dataPtr);
                    }
                    if ((progress = Math.floor((offset / fileSize) * 100)) != lastProgress) {
                        lastProgress = progress;
                        trackEntry.hash = "hashing " + progress + "%";
                        updateTrackEntry(index);
                    }
                } else {
                    md5_free(md5_ctx);
                    md5_ctx = null;
                    trackEntry.hash = "error";
                    updateTrackEntry(index);
                    console.log("Read error: ");
                    console.log(evt.target.error);
                    reject();
                    return;
                }
                if (offset >= fileSize) {
                    var resultSize = 16;
                    var dataPtr = MD5Module._malloc(resultSize);
                    var dataHeap = new Uint8Array(MD5Module.HEAPU8.buffer, dataPtr, resultSize);
                    md5_final(md5_ctx, dataHeap.byteOffset);
                    md5_free(md5_ctx);
                    md5_ctx = null;
                    var hash = '';
                    for (let i = 0; i < 16; ++i) {
                        hash += dataHeap[i].toString(16).toLowerCase().padStart(2, '0');
                    }
                    MD5Module._free(dataPtr);
                    trackEntry.hash = hash;
                    updateTrackEntry(index);
                    resolve(true);
                    return;
                }

                // of to the next chunk
                chunkReaderBlock(offset, chunkSize, trackEntry.file);
            }

            chunkReaderBlock = function (_offset, length, _file) {
                var r = new FileReader();
                var blob = _file.slice(_offset, length + _offset);
                r.onload = readEventHandler;
                r.readAsArrayBuffer(blob);
            }

            // now let's start the read with the first block
            chunkReaderBlock(offset, chunkSize, trackEntry.file);
        });

    }

    var entriesToSearch = [];
    var searching = 0;

    function tryToSearch() {
        if (searching >= 3 || entriesToSearch.length === 0) {
            return;
        }
        searching++;
        var index = entriesToSearch.shift();
        doSearchOperations(index).then((results) => {
            searching--;
            $(trackEntries[index].element).removeClass("progress-search");
            console.log(results);
            for (var j = 0; j < results.length; ++j) {
                createResultEntry(index, results[j]);
            }
            if (results.length === 0) {
                $(trackEntries[index].element).find(".results-entry").append("No results.");
                $(trackEntries[index].element).addClass("progress-error");
            } else {
                $(trackEntries[index].element).addClass("progress-success");
            }
            tryToSearch();
        }).catch((e) => {
            searching--;
            console.log(e);
            $(trackEntries[index].element).addClass("progress-error");
            $(trackEntries[index].element).find(".results-entry").append("An error ocurred: " + e);
            tryToSearch();
        });
    }

    $("#tracks-input").on("change", function () {
        resetSearch();

        for (var i = 0; i < this.files.length; ++i) {
            addFileToList(this.files[i]).then((index) => {
                $(trackEntries[index].element).addClass("progress-search");
                entriesToSearch.push(index);
                tryToSearch();
            }).catch((index, e) => {
                console.log(e);
                $(trackEntries[index].element).addClass("progress-error");
                $(trackEntries[index].element).find(".results-entry").append("An error ocurred: " + e);
            });
        }
    });

    $("#tracks-text").on("change", function () {
        resetSearch();

        for (var i = 0; i < this.files.length; ++i) {
            var file = this.files[i];
            var extension = file.name.substr(file.name.lastIndexOf('.') + 1).toLowerCase();
            if (extension === 'csv' || extension === 'txt') {
                CSV.fetch({
                        file: file,
                        dialect: {}
                    }
                ).done(function (dataset) {
                    for (let j = 0; j < dataset.records.length; ++j) {
                        var entry = {};
                        for (let k = 0; k < dataset.records[j].length; ++k) {
                            entry[dataset.fields[k]] = dataset.records[j][k];
                        }
                        addRawEntryToList(entry).then((index) => {
                            $(trackEntries[index].element).addClass("progress-search");
                            entriesToSearch.push(index);
                            tryToSearch();
                        }).catch((index, e) => {
                            console.log(e);
                            $(trackEntries[index].element).addClass("progress-error");
                            $(trackEntries[index].element).find(".results-entry").append("An error ocurred: " + e);
                        });
                    }
                });
            } else if (extension === 'json' || extension === '.js') {
                var reader = new FileReader();
                reader.onload = function (event) {
                    var dataset = JSON.parse(event.target.result);
                    if ('message' in dataset && 'favorites' in dataset) {
                        //Assume listen.moe format
                        for (let j = 0; j < dataset.favorites.length; ++j) {
                            var data = dataset.favorites[j];
                            var entry = {
                                title: data.title,
                                duration: data.duration,
                                artist: data.artists.length > 0 ? data.artists[0].name : null,
                                album_artist: data.artists.length > 0 ? data.artists[0].nameRomaji : null,
                                album: data.albums.length > 0 ? data.albums[0].name : null,
                                coverArt: null
                            };

                            addRawEntryToList(entry).then((index) => {
                                $(trackEntries[index].element).addClass("progress-search");
                                entriesToSearch.push(index);
                                tryToSearch();
                            }).catch((index, e) => {
                                console.log(e);
                                $(trackEntries[index].element).addClass("progress-error");
                                $(trackEntries[index].element).find(".results-entry").append("An error ocurred: " + e);
                            });
                        }
                    } else {
                        for (let j = 0; j < dataset.length; ++j) {
                            addRawEntryToList(dataset[j]).then((index) => {
                                $(trackEntries[index].element).addClass("progress-search");
                                entriesToSearch.push(index);
                                tryToSearch();
                            }).catch((index, e) => {
                                console.log(e);
                                $(trackEntries[index].element).addClass("progress-error");
                                $(trackEntries[index].element).find(".results-entry").append("An error ocurred: " + e);
                            });
                        }
                    }
                }
                reader.readAsText(file);
            }
        }
    });
</script>
</html>
