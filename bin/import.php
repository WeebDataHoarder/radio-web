<?php

require_once("common.php");

$key = getAuthenticationKey();
if ($key === null) {
    http_response_code(403);
    echo("You need to authenticate on main page before using the Favorite Import service");
    exit();
}

$dbconn = connectToMusicDatabase();
if ($dbconn === null) {
    exit();
}

$user = checkAuthenticationKey($dbconn, $key);
if ($user === null) {
    http_response_code(403);
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
<p>Current containers supported: .flac, .ogg (Opus, FLAC), .opus, .m4a (AAC, ALAC), .mp3, .wav, .tta and other(s).</p>
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
It also supports JSON favorite extracts from listen.moe and r-a-d.io.
<br>
<label>Tracks to search (.csv, .json) <input type="file" id="tracks-text" accept=".csv,.json,.js,.txt"/></label>
</p>
<hr>
<div id="tracks-list"></div>
</body>
<script type="text/javascript" nonce="<?php echo SCRIPT_NONCE; ?>">

    const trackEntries = [];
    const username = <?php echo json_encode($user["name"]); ?>;

    function addTrackToFavorites() {
        const thisElement = this;
        fetch("/api/favorites/" + username + "/" + this.getAttribute("data-track-hash"), {
            method: "PUT",
            mode: "cors",
            credentials: "include"
        }).then((response) => {
            if(response.ok){
                thisElement.style.display = "none"; //TODO: animate this
            }

        });
    }

    function createTrackEntry(i) {
        const trackEntry = document.createElement("div");
        trackEntries[i].element = trackEntry;
        trackEntry.setAttribute("id", "track-" + i);
        trackEntry.classList.add("track-entry");

        const coverArea = document.createElement("div");
        coverArea.classList.add("metadata-cover-area");
        trackEntry.append(coverArea);

        const metaArea = document.createElement("div");
        metaArea.classList.add("metadata-meta-area");
        trackEntry.append(metaArea);

        const hashEntry = document.createElement("a");
        hashEntry.classList.add("hash-entry");
        metaArea.append(hashEntry);
        metaArea.append("::");

        const pathEntry = document.createElement("code");
        pathEntry.classList.add("path-entry");
        metaArea.append(pathEntry);
        metaArea.append(document.createElement("br"));

        const metadataEntry = document.createElement("div");
        metadataEntry.classList.add("metadata-entry");
        metaArea.append(metadataEntry);
        metaArea.append(document.createElement("br"));

        const titleEntry = document.createElement("span");
        titleEntry.classList.add("metadata-title-entry");
        metadataEntry.append(titleEntry);
        metadataEntry.append(" from ");

        const albumEntry = document.createElement("span");
        albumEntry.classList.add("metadata-album-entry");
        metadataEntry.append(albumEntry);
        metadataEntry.append(" by ");

        const artistEntry = document.createElement("span");
        artistEntry.classList.add("metadata-artist-entry");
        metadataEntry.append(artistEntry);

        metadataEntry.append(" - ");

        const durationEntry = document.createElement("span");
        durationEntry.classList.add("metadata-duration-entry");
        metadataEntry.append(durationEntry);

        const resultsEntry = document.createElement("ul");
        resultsEntry.classList.add("results-entry");
        trackEntry.append(resultsEntry);

        updateTrackEntry(i);

        document.querySelector("#tracks-list").append(trackEntry);
    }

    function createResultEntry(i, song) {
        const resultEntry = document.createElement("li");
        resultEntry.classList.add("track-entry");
        resultEntry.setAttribute("data-track-hash", song.hash);
        if (!song.favored_by.includes(username)) {
            resultEntry.addEventListener("click", addTrackToFavorites);
        } else {
            resultEntry.classList.add("track-favorited");
        }

        const coverArea = document.createElement("div");
        coverArea.classList.add("metadata-cover-area");
        if (song.cover !== null) {
            coverArea.style["background-image"] = "url(/api/cover/" + song.cover + "/small)";
        }
        resultEntry.append(coverArea);

        const metaArea = document.createElement("div");
        metaArea.classList.add("metadata-meta-area");
        resultEntry.append(metaArea);

        const hashEntry = document.createElement("code");
        hashEntry.classList.add("hash-entry");
        hashEntry.textContent = song.hash.substring(0, 12);
        metaArea.append(hashEntry);
        metaArea.append("::");

        const pathEntry = document.createElement("code");
        pathEntry.classList.add("path-entry");
        pathEntry.textContent = song.path.substr(song.path.lastIndexOf('/') + 1);
        metaArea.append(pathEntry);

        const metadataEntry = document.createElement("div");
        metadataEntry.classList.add("metadata-entry");
        metaArea.append(metadataEntry);

        const titleEntry = document.createElement("span");
        titleEntry.classList.add("metadata-title-entry");
        titleEntry.textContent = song.title;
        if (song.favored_by.length > 0) {
            titleEntry.textContent = song.favored_by.length + " ❤︎ :: " + song.title;
        } else {
            titleEntry.textContent = song.title;
        }
        metadataEntry.append(titleEntry);
        metadataEntry.append(" from ");

        const albumEntry = document.createElement("span");
        albumEntry.classList.add("metadata-album-entry");
        albumEntry.textContent = song.album;
        metadataEntry.append(albumEntry);
        metadataEntry.append(" by ");

        const artistEntry = document.createElement("span");
        artistEntry.classList.add("metadata-artist-entry");
        artistEntry.textContent = song.artist;
        metadataEntry.append(artistEntry);

        metadataEntry.append(" ");

        const durationEntry = document.createElement("span");
        durationEntry.classList.add("metadata-duration-entry");
        const seconds = ("" + (song.duration % 60)).padStart(2, "0");
        const minutes = ("" + Math.floor(song.duration / 60)).padStart(2, "0");
        durationEntry.textContent = "[" + minutes + ":" + seconds + "]";
        metadataEntry.append(durationEntry);


        trackEntries[i].element.querySelector(".results-entry").append(resultEntry);
    }

    function updateTrackEntry(i) {
        const trackEntry = trackEntries[i];
        if (trackEntry.hash !== null) {
            trackEntry.element.querySelector(".hash-entry").textContent = trackEntry.hash.substring(0, 12);
        }
        if (trackEntry.path !== null) {
            trackEntry.element.querySelector(".path-entry").textContent = trackEntry.path;
        }
        if (trackEntry.coverArt !== null) {
            trackEntry.element.querySelector(".metadata-cover-area").style["background-image"] = "url(" + trackEntry.coverArt + ")";
        }
        if (trackEntry.title !== null) {
            trackEntry.element.querySelector(".metadata-title-entry").textContent = trackEntry.title;
        }
        if (trackEntry.album !== null) {
            trackEntry.element.querySelector(".metadata-album-entry").textContent = trackEntry.album;
        }
        if (trackEntry.artist !== null) {
            trackEntry.element.querySelector(".metadata-artist-entry").textContent = trackEntry.artist;
        }
        if (trackEntry.duration !== null) {
            const seconds = ("" + (trackEntry.duration % 60)).padStart(2, "0");
            const minutes = ("" + Math.floor(trackEntry.duration / 60)).padStart(2, "0");
            trackEntry.element.querySelector(".metadata-duration-entry").textContent = "[" + minutes + ":" + seconds + "]";
        }
    }

    function resetSearch() {
        document.querySelector("#tracks-list").innerHTML = "";
        trackEntries.length = 0;
    }

    function doHashCheck() {
        return document.querySelector("#do-hash").checked;
    }

    function doMetadataCheck() {
        return document.querySelector("#do-metadata").checked;
    }

    function addFileToList(file) {
        return new Promise((resolve, reject) => {
            const index = trackEntries.push({
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

    async function addRawEntryToList(entry) {
        const index = trackEntries.push({
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
        await createTrackEntry(index);

        return index;
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
            const trackEntry = trackEntries[index];
            if (trackEntry.file === null) {
                resolve();
                return;
            }
            const asset = AV.Asset.fromFile(trackEntry.file);
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

    async function doSearch(query) {
        let url = new URL("/api/search", document.location.origin);
        url.searchParams.append("q", query);
        url.searchParams.append("limit", 500);
        url.searchParams.append("orderBy", "score");
        url.searchParams.append("orderDirection", "desc");

        const response = await fetch(url, {
            credentials: "same-origin",
            method: "GET"
        });

        return await response.json();
    }

    function doSearchOperations(index) {
        return new Promise((resolve, reject) => {
            const trackEntry = trackEntries[index];
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
                        " OR path:\"/" + escapeQuotes(trackEntry.path !== null ? trackEntry.path : "[Unknown Path]") + "\"" +
                        " OR artist=\"" + escapeQuotes(trackEntry.artist !== null ? trackEntry.artist : "[Unknown Artist]") + "\"" +
                        " OR artist=\"" + escapeQuotes((trackEntry.album_artist !== null && trackEntry.album_artist !== trackEntry.artist) ? trackEntry.album_artist : "[Unknown Artist]") + "\"" +
                        " OR album=\"" + escapeQuotes(trackEntry.album !== null ? trackEntry.album : "[Unknown Album]") + "\"" +
                        ")"
                    );
                    queryGroups.push(
                        "duration<" + (trackEntry.duration + 3) + " AND duration>" + (trackEntry.duration - 3) +
                        " AND (title:\"" + escapeQuotes(trackEntry.title !== null ? trackEntry.title : "[Unknown Title]") + "\"" +
                        " OR path:\"/" + escapeQuotes(trackEntry.path !== null ? trackEntry.path : "[Unknown Path]") + "\"" +
                        " OR artist:\"" + escapeQuotes(trackEntry.artist !== null ? trackEntry.artist : "[Unknown Artist]") + "\"" +
                        " OR artist:\"" + escapeQuotes((trackEntry.album_artist !== null && trackEntry.album_artist !== trackEntry.artist) ? trackEntry.album_artist : "[Unknown Artist]") + "\"" +
                        " OR artist~\"" + escapeQuotes(trackEntry.artist !== null ? trackEntry.artist : "[Unknown Artist]") + "\"" +
                        " OR artist~\"" + escapeQuotes((trackEntry.album_artist !== null && trackEntry.album_artist !== trackEntry.artist) ? trackEntry.album_artist : "[Unknown Artist]") + "\"" +
                        " OR album:\"" + escapeQuotes(trackEntry.album !== null ? trackEntry.album : "[Unknown Album]") + "\"" +
                        ")"
                    );
                    queryGroups.push(
                        "duration<" + (trackEntry.duration + 4) + " AND duration>" + (trackEntry.duration - 4) +
                        " AND (" +
                        (trackEntry.title !== null ? "(" + escapeParenthesis(trackEntry.title) + ") OR " : "") +
                        (trackEntry.artist !== null ? "(" + escapeParenthesis(trackEntry.artist) + ") OR " : "") +
                        ((trackEntry.album_artist !== null && trackEntry.album_artist !== trackEntry.artist) ? "(" + escapeParenthesis(trackEntry.album_artist) + ") OR " : "") +
                        (trackEntry.album !== null ? "(" + escapeParenthesis(trackEntry.album) + ") OR " : "") +
                        "hash=00000000000000000000000000000000)" +
                        ")"
                    );
                } else if (trackEntry.title !== null) {
                    queryGroups.push(
                        "(title=\"" + escapeQuotes(trackEntry.title) + "\"" +
                        (trackEntry.path !== null ? " AND path:\"/" + escapeQuotes(trackEntry.path) + "\"" : "") +
                        (trackEntry.artist !== null ? " AND artist=\"" + escapeQuotes(trackEntry.artist) + "\"" : "") +
                        (trackEntry.artist !== null ? " AND artist=\"" + escapeQuotes(trackEntry.artist) + "\"" : "") +
                        (trackEntry.album !== null ? " AND album=\"" + escapeQuotes(trackEntry.album) + "\"" : "") +
                        ")"
                    );

                    queryGroups.push(
                        "(title:\"" + escapeQuotes(trackEntry.title) + "\"" +
                        (trackEntry.path !== null ? " AND path:\"/" + escapeQuotes(trackEntry.path) + "\"" : "") +
                        (trackEntry.artist !== null ? " AND (artist:\"" + escapeQuotes(trackEntry.artist) + "\" OR artist~\"" + escapeQuotes(trackEntry.artist) + "\")" : "") +
                        ((trackEntry.album_artist !== null && trackEntry.album_artist !== trackEntry.artist) ? " AND (artist:\"" + escapeQuotes(trackEntry.album_artist) + "\" OR artist~\"" + escapeQuotes(trackEntry.album_artist) + "\")" : "") +
                        (trackEntry.album !== null ? " AND album:\"" + escapeQuotes(trackEntry.album) + "\"" : "") +
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
            const title1 = clearNameForMatch(trackEntry.title);
            const album1 = clearNameForMatch(trackEntry.album);
            const artist1 = clearNameForMatch(trackEntry.artist);
            const album_artist1 = clearNameForMatch(trackEntry.album_artist);
            const path1 = clearNameForMatch(trackEntry.path);

            for (let i = 0; i < data.length; ++i) {
                let t = data[i];
                if (t.hash === trackEntry.hash) {
                    results.unshift(t);
                    break;
                }
                const title2 = clearNameForMatch(t.title);
                const album2 = clearNameForMatch(t.album);
                const artist2 = clearNameForMatch(t.artist);
                const path2 = t.path.substr(t.path.lastIndexOf('/') + 1);
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
            const trackEntry = trackEntries[index];
            if (trackEntry.file === null) {
                resolve(null);
                return;
            }
            trackEntry.hash = "hashing 0%";
            updateTrackEntry(index);

            const fileSize = trackEntry.file.size;
            const chunkSize = 0x10000; // bytes
            let md5_ctx = md5_init();
            let offset = 0;
            const self = this; // we need a reference to the current object
            let chunkReaderBlock = null;
            let lastProgress = 0;

            const readEventHandler = function (evt) {
                let dataHeap;
                let dataPtr;
                if (md5_ctx === null) {
                    reject();
                    //????
                    return;
                }
                if (evt.target.error == null) {
                    offset += evt.target.result.byteLength;
                    dataPtr = MD5Module._malloc(evt.target.result.byteLength);
                    dataHeap = new Uint8Array(MD5Module.HEAPU8.buffer, dataPtr, evt.target.result.byteLength);
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
                    const resultSize = 16;
                    dataPtr = MD5Module._malloc(resultSize);
                    dataHeap = new Uint8Array(MD5Module.HEAPU8.buffer, dataPtr, resultSize);
                    md5_final(md5_ctx, dataHeap.byteOffset);
                    md5_free(md5_ctx);
                    md5_ctx = null;
                    let hash = '';
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
            };

            chunkReaderBlock = function (_offset, length, _file) {
                const r = new FileReader();
                const blob = _file.slice(_offset, length + _offset);
                r.onload = readEventHandler;
                r.readAsArrayBuffer(blob);
            }

            // now let's start the read with the first block
            chunkReaderBlock(offset, chunkSize, trackEntry.file);
        });

    }

    const entriesToSearch = [];
    let searching = 0;

    function tryToSearch() {
        if (searching >= 3 || entriesToSearch.length === 0) {
            return;
        }
        searching++;
        const index = entriesToSearch.shift();
        doSearchOperations(index).then((results) => {
            searching--;
            trackEntries[index].element.classList.remove("progress-search");
            console.log(results);
            for (var j = 0; j < results.length; ++j) {
                createResultEntry(index, results[j]);
            }
            if (results.length === 0) {
                trackEntries[index].element.querySelector(".results-entry").append("No results.");
                trackEntries[index].element.classList.add("progress-error");
            } else {
                trackEntries[index].element.classList.add("progress-success");
            }
            tryToSearch();
        }).catch((e) => {
            searching--;
            console.log(e);
            trackEntries[index].element.classList.add("progress-error");
            trackEntries[index].element.querySelector(".results-entry").append("An error ocurred: " + e);
            tryToSearch();
        });
    }

    document.querySelector("#tracks-input").addEventListener("change", function () {
        resetSearch();

        for (let i = 0; i < this.files.length; ++i) {
            const file = this.files[i];
            addFileToList(file).then((index) => {
                trackEntries[index].element.classList.add("progress-search");
                entriesToSearch.push(index);
                tryToSearch();
            }).catch((index, e) => {
                console.log(e);
                trackEntries[index].element.classList.add("progress-error");
                trackEntries[index].element.querySelector(".results-entry").append("An error ocurred: " + e);
            });
        }
    });

    document.querySelector("#tracks-text").addEventListener("change", function () {
        resetSearch();

        for (let i = 0; i < this.files.length; ++i) {
            const file = this.files[i];
            const extension = file.name.substr(file.name.lastIndexOf('.') + 1).toLowerCase();
            if (extension === 'csv' || extension === 'txt') {
                CSV.fetch({
                        file: file,
                        dialect: {}
                    }
                ).done(function (dataset) {
                    for (let j = 0; j < dataset.records.length; ++j) {
                        const entry = {};
                        for (let k = 0; k < dataset.records[j].length; ++k) {
                            entry[dataset.fields[k]] = dataset.records[j][k];
                        }
                        addRawEntryToList(entry).then((index) => {
                            trackEntries[index].element.classList.add("progress-search");
                            entriesToSearch.push(index);
                            tryToSearch();
                        }).catch((index, e) => {
                            console.log(e);
                            trackEntries[index].element.classList.add("progress-error");
                            trackEntries[index].element.querySelector(".results-entry").append("An error ocurred: " + e);
                        });
                    }
                });
            } else if (extension === 'json' || extension === 'js') {
                const reader = new FileReader();
                reader.onload = function (event) {
                    const dataset = JSON.parse(event.target.result);
                    if (('message' in dataset) && ('favorites' in dataset)) {
                        //Assume listen.moe format
                        dataset.favorites.forEach((data) => {
                            const entry = {
                                title: data.title,
                                duration: data.duration,
                                artist: data.artists.length > 0 ? data.artists[0].name : null,
                                album_artist: data.artists.length > 0 ? data.artists[0].nameRomaji : null,
                                album: data.albums.length > 0 ? data.albums[0].name : null,
                                coverArt: null
                            };

                            addRawEntryToList(entry).then((index) => {
                                trackEntries[index].element.classList.add("progress-search");
                                entriesToSearch.push(index);
                                tryToSearch();
                            }).catch((index, e) => {
                                console.log(e);
                                trackEntries[index].element.classList.add("progress-error");
                                trackEntries[index].element.querySelector(".results-entry").append("An error ocurred: " + e);
                            });
                        });
                    } else if (Array.isArray(dataset) && dataset.length > 0 && ('tracks_id' in dataset[0]) && ('meta' in dataset[0])) {
                        //Assume r-a-d.io format
                        dataset.forEach((data) => {
                            const matches = data.meta.match(/^(?<artist>[^\-]*)- (?<title>.+)$/);
                            if(matches !== null){
                                const entry = {
                                    title: matches.groups.title,
                                    duration: null,
                                    artist: matches.groups.artist.length > 0 ? matches.groups.artist : null,
                                    album_artist: matches.groups.artist.length > 0 ? matches.groups.artist : null,
                                    album: null,
                                    coverArt: null
                                };

                                addRawEntryToList(entry).then((index) => {
                                    trackEntries[index].element.classList.add("progress-search");
                                    entriesToSearch.push(index);
                                    tryToSearch();
                                }).catch((index, e) => {
                                    console.log(e);
                                    trackEntries[index].element.classList.add("progress-error");
                                    trackEntries[index].element.querySelector(".results-entry").append("An error ocurred: " + e);
                                });
                            }

                        });
                    } else {
                        dataset.forEach((entry) => {
                            addRawEntryToList(entry).then((index) => {
                                trackEntries[index].element.classList.add("progress-search");
                                entriesToSearch.push(index);
                                tryToSearch();
                            }).catch((index, e) => {
                                console.log(e);
                                trackEntries[index].element.classList.add("progress-error");
                                trackEntries[index].element.querySelector(".results-entry").append("An error ocurred: " + e);
                            });
                        });
                    }
                }
                reader.readAsText(file);
            }
        }
    });
</script>
</html>
