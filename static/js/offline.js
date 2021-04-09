let shuffledPlaylist = [];


const baseApiUrl = window.localStorage.getItem("radio-api-url") != null ? window.localStorage.getItem("radio-api-url") : location.protocol + '//' + document.domain + ':' + location.port;

let showOriginalLyrics = !!(window.localStorage.getItem("lyrics-original") !== null ? parseInt(window.localStorage.getItem("lyrics-original")) : 0);
const loadLyrics = !!(window.localStorage.getItem("lyrics-show") !== null ? parseInt(window.localStorage.getItem("lyrics-show")) : 1);
const lyricsAnimationLevel = (window.localStorage.getItem("lyrics-animations") !== null ? parseInt(window.localStorage.getItem("lyrics-animations")) : 1); // 0 = no, 1 = all, 2 = only fade in/out

let playing = false;
const urlParams = new URLSearchParams(window.location.search);

let index;
let currentPlaylistIndex;
let repeat;
let shuffle;
let currentLyrics = null;
const seekElement = document.querySelector(".radio-song-slider");

let currentTime = 0;

const uplayer = new UPlayer({
    "volume": window.localStorage.getItem("radio-volume") !== null ? window.localStorage.getItem("radio-volume") / 100 : 1.0,
    "preload": true,
    //"streaming": true,
    "forceCodec": urlParams.get("forceCodec") !== null ? true : navigator.userAgent.match(/(Macintosh|iOS|iPad|iPhone)((?!Chrom(ium|e)\/).)*$/) !== null,
    "muted": false,
    "retry": false,
    "limitCodecs": limitCodecs,
    "play-pause-element": document.querySelector(".play-pause"),
    "progress-minutes-element": document.querySelector(".radio-current-minutes"),
    "progress-seconds-element": document.querySelector(".radio-current-seconds"),
    "duration-minutes-element": document.querySelector(".radio-duration-minutes"),
    "duration-seconds-element": document.querySelector(".radio-duration-seconds"),
    "progress-element": document.querySelector(".radio-song-played-progress"),
    "seek-element": seekElement,
    "buffer-progress-element": document.querySelector(".radio-buffered-progress"),
    "mute-element": document.querySelector(".mute"),
    "volume-element": document.querySelector(".volume-slider"),
    "on-end": function () {
        currentTime = 0;
        ++currentPlaylistIndex;
        if (currentPlaylistIndex >= songPlaylist.length) {
            if (repeat) {
                currentPlaylistIndex = 0;
            } else {
                return;
            }
        }
        playing = true;
        if (shuffle) {
            playThisSong(shuffledPlaylist[currentPlaylistIndex], true);
        } else {
            playThisSong(songPlaylist[currentPlaylistIndex], true);
        }
    },
    "on-pre-end": function () {
        index = currentPlaylistIndex + 1;
        if (index >= songPlaylist.length) {
            if (repeat) {
                index = 0;
            } else {
                return;
            }
        }
        playing = true;
        if (shuffle) {
            preloadThisSong(shuffledPlaylist[index], true);
        } else {
            preloadThisSong(songPlaylist[index], true);
        }
    },
    "on-ready": function () {
        if (playing) {
            uplayer.play(true);
        }
        //$(".play-pause").removeClass("hidden");
    },
    "on-progress": function () {
        currentTime = uplayer.currentProgress * uplayer.totalDuration;
        getSubtitles().then((s)=> {
            s.setCurrentTime(currentTime)
        });

        if ('mediaSession' in navigator) {
            navigator.mediaSession.setPositionState({
                duration: uplayer.totalDuration,
                playbackRate: 1.0,
                position: currentTime
            });
        }
    }
});

let _subtitlesPromise = null;
function getSubtitles(){
    return _subtitlesPromise !== null ? _subtitlesPromise : _subtitlesPromise = (async () => {
        const module = await import("./modules/subtitles.mjs?" + VERSION_HASH);

        const navigatorHasImprecisePlaybackTime = navigator.userAgent.match(/(AppleWebKit)((?!Chrom(ium|e)\/).)*$/) !== null;

        return new module.default(document.getElementById("lyrics-area"), {
            displaySettings: {
                showOriginal: showOriginalLyrics,
                fadeTransition: lyricsAnimationLevel > 0,
                karaoke: lyricsAnimationLevel === 0 ? false : {
                    animate: lyricsAnimationLevel === 1
                }
            },
            currentTimeCallback: () => {
                if(navigatorHasImprecisePlaybackTime || !uplayer.nativePlayback){
                    return {
                        precise: !uplayer.isPlaying(),
                        time: currentTime
                    }
                }else{
                    return {
                        precise: true,
                        time: uplayer.nativePlayback ? uplayer.playerObject.currentTime : uplayer.playerObject.currentTime / 1000
                    }
                }
            }
        });
    })();
}


document.querySelector(".volume-slider").addEventListener("change", function () {
    window.localStorage.setItem("radio-volume", this.value);
});

document.querySelector("#lyrics-area").addEventListener("click", () => {
    showOriginalLyrics = !showOriginalLyrics;
    window.localStorage.setItem("lyrics-original", showOriginalLyrics ? "1" : "0");
    if(currentLyrics !== null){


        if("entries" in currentLyrics){
            currentLyrics.type = "entries";
            getSubtitles().then(async (s) => {
                await s.loadSubtitles(currentLyrics, {
                    displaySettings: {
                        showOriginal: showOriginalLyrics,
                        fadeTransition: lyricsAnimationLevel > 0,
                        karaoke: lyricsAnimationLevel === 0 ? false : {
                            animate: lyricsAnimationLevel === 1
                        }
                    },
                });
            });
        }
    }
});


const songElement = document.querySelector("div#radio-right").cloneNode(false);
songElement.innerHTML = "";
let prevData = null;

for (index = 0; index < songPlaylist.length; ++index) {
    const data = songPlaylist[index];
    if (!('url' in data)){
        data.url = "/api/download/" + data.hash;
    }
    if(prevData !== null){
        if (!('album' in data)){
            data.album = prevData.album;
        }
        if (!('artist' in data)){
            data.artist = prevData.artist;
        }
        if (!('cover' in data)){
            data.cover = prevData.cover;
        }
        if (!('tags' in data)){
            data.tags = prevData.tags;
        }
        if (!('mime' in data)){
            data.mime = prevData.mime;
        }
    }
    if (doSplitPlayer && (index === 0 || songPlaylist[index - 1]["album"] !== data["album"])) {
        if(index > 0){
            songElement.append(document.createElement("hr"));
        }

        const e = document.createElement("div");
        e.classList.add("album-header");
        e.textContent = data["album"];

        songElement.append(e);
    }

    const e = document.createElement("div");
    e.classList.add("song", "radio-song-container");
    e.setAttribute("data-song-index", index);
    e.setAttribute("data-song-hash", data["hash"]);
    {
        const fit = document.createElement("div");
        fit.classList.add("queue-fit");
        const im = document.createElement("img");
        im.classList.add("queue-cover");
        im.setAttribute("data-src", data["cover"] !== null ? "/api/cover/" + data["cover"] + "/small" : "/img/no-cover.jpg");
        fit.append(im);

        e.append(fit);
    }
    {
        const c = document.createElement("div");
        c.classList.add("song-now-playing-icon-container");
        const p = document.createElement("div");
        p.classList.add("play-button-container");
        c.append(p);
        const im = document.createElement("img");
        im.classList.add("now-playing");
        im.src = "/img/now-playing.svg";
        c.append(im);

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
        duration.textContent = uplayer.zeroPad(Math.floor(data["duration"] / 60), 2) + ':' + uplayer.zeroPad(data["duration"] % 60, 2);
        e.append(duration);
    }

    songElement.append(e);

    prevData = data;
}
document.querySelector("div#radio-right").replaceWith(songElement);

document.addEventListener("DOMContentLoaded", function() {
    const lazyImages = [].slice.call(document.querySelectorAll(".queue-cover"));

    if ("IntersectionObserver" in window) {
        let lazyImageObserver = new IntersectionObserver(function(entries, observer) {
            for (const entry of entries){
                if (entry.isIntersecting) {
                    entry.target.src = entry.target.getAttribute("data-src");
                    lazyImageObserver.unobserve(entry.target);
                }
            }
        }, {
            rootMargin: '250px'
        });

        for (const lazyBackground of lazyImages){
            lazyImageObserver.observe(lazyBackground);
        }
    }
});

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

currentPlaylistIndex = 0;
repeat = false;
shuffle = false;
document.querySelector(".radio-repeat").classList.add("repeat-off");
document.querySelector(".radio-shuffle").classList.add("shuffle-off");

document.querySelector(".radio-repeat").addEventListener("click", function () {
    if (repeat) {
        repeat = false;
        document.querySelector(".radio-repeat").classList.remove("repeat-on");
        document.querySelector(".radio-repeat").classList.add("repeat-off");
    } else {
        repeat = true;
        document.querySelector(".radio-repeat").classList.remove("repeat-off");
        document.querySelector(".radio-repeat").classList.add("repeat-on");
    }
});

document.querySelector(".radio-shuffle").addEventListener("click", function () {
    if (shuffle) {
        shuffle = false;
        document.querySelector(".radio-shuffle").classList.remove("shuffle-on");
        document.querySelector(".radio-shuffle").classList.add("shuffle-off");
    } else {
        shuffle = true;
        document.querySelector(".radio-shuffle").classList.remove("shuffle-off");
        document.querySelector(".radio-shuffle").classList.add("shuffle-on");
        shuffledPlaylist = songPlaylist.slice();
        shuffleArray(shuffledPlaylist);
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


function nextSong() {
    ++currentPlaylistIndex;
    if (currentPlaylistIndex >= songPlaylist.length) {
        currentPlaylistIndex = 0;
    }
    if (shuffle) {
        playThisSong(shuffledPlaylist[currentPlaylistIndex]);
    } else {
        playThisSong(songPlaylist[currentPlaylistIndex]);
    }
}

function previousSong() {
    --currentPlaylistIndex;
    if (currentPlaylistIndex < 0) {
        currentPlaylistIndex = songPlaylist.length - 1;
    }
    if (shuffle) {
        playThisSong(shuffledPlaylist[currentPlaylistIndex]);
    } else {
        playThisSong(songPlaylist[currentPlaylistIndex]);
    }
}

document.querySelector(".radio-next").addEventListener("click", nextSong);
document.querySelector(".radio-prev").addEventListener("click", previousSong);

try{
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('nexttrack', nextSong);
        navigator.mediaSession.setActionHandler('previoustrack', previousSong);
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
            seekElement.value = (Math.min(uplayer.totalDuration, Math.max(0, uplayer.currentProgress * uplayer.totalDuration - (details.seekOffset || 30))) / uplayer.totalDuration) * 100;
            seekElement.dispatchEvent(new Event("change"));
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
            seekElement.value = (Math.min(uplayer.totalDuration, Math.max(0, uplayer.currentProgress * uplayer.totalDuration + (details.seekOffset || 30))) / uplayer.totalDuration) * 100;
            seekElement.dispatchEvent(new Event("change"));
        });
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            seekElement.value = (Math.min(uplayer.totalDuration, Math.max(0, details.seekTime)) / uplayer.totalDuration) * 100;
            seekElement.dispatchEvent(new Event("change"));
        });
    }
}catch (e){
    console.log(e);
}


for (const e of document.querySelectorAll(".radio-song-container")){
    e.addEventListener("click", function () {
        currentPlaylistIndex = parseInt(this.getAttribute("data-song-index"));
        playThisSong(songPlaylist[currentPlaylistIndex]);
    });
}


function preloadThisSong(song, isPlaying = null) {
    console.log("Trying to preload next track " + song["url"]);
    uplayer.preload(song["url"], [song["mime"]]).then(e => {
        console.log("preloaded next song!");
    }).catch(e => {
        console.log("failed to preload: ");
        console.log(e);
    });
}

async function tryLoadLyrics(song){
    currentLyrics = null;
    let s = await getSubtitles();
    s.stopSubtitles();
    if(loadLyrics){
        const preferredLyrics = ["ass", "timed"];
        let subtitleEntry = null;

        for(let index = 0; index < preferredLyrics.length; ++index){
            if('lyrics' in song && song.lyrics.includes(preferredLyrics[index])){
                subtitleEntry = preferredLyrics[index];

                try{
                    const data = await apiRequest("/api/lyrics/" + song.hash + "/" + subtitleEntry);
                    if(subtitleEntry === "timed"){
                        await s.loadSubtitles(currentLyrics = {
                            type: "lrc",
                            content: data
                        }, {
                            displaySettings: {
                                showOriginal: showOriginalLyrics,
                                fadeTransition: lyricsAnimationLevel > 0,
                                karaoke: lyricsAnimationLevel === 0 ? false : {
                                    animate: lyricsAnimationLevel === 1
                                }
                            },
                        });
                        return;
                    }else if(subtitleEntry === "ass"){
                        await s.loadSubtitles(currentLyrics = {
                            type: "ass",
                            content: data
                        }, {
                            displaySettings: {
                                showOriginal: showOriginalLyrics,
                                fadeTransition: lyricsAnimationLevel > 0,
                                karaoke: lyricsAnimationLevel === 0 ? false : {
                                    animate: lyricsAnimationLevel === 1
                                }
                            },
                        });
                        return;
                    }
                }catch (e){
                    console.log(e);
                    s.stopSubtitles();
                    s.hideSubtitles();
                }
            }
        }
    }else{
        s.hideSubtitles();
    }
}

function playThisSong(song, isPlaying = null) {
    if (isPlaying === null) {
        playing = uplayer.isPlaying();
    } else {
        playing = isPlaying;
    }

    uplayer.init(song["url"], [song["mime"]]);
    const oldActiveElement = document.querySelector(".active-song-container");
    const newActiveElement = document.querySelector(".song[data-song-hash=\"" + song["hash"] + "\"]");
    if (oldActiveElement && newActiveElement) {
        const oldBounds = oldActiveElement.getBoundingClientRect();
        if ((oldBounds.top >= 0 && oldBounds.bottom <= window.innerHeight) || (oldBounds.top < window.innerHeight && oldBounds.bottom >= 0)) {
            let newBounds = newActiveElement.getBoundingClientRect();
            if (!(newBounds.top >= 0 && newBounds.bottom <= window.innerHeight)) {
                const yCoordinate = newBounds.top + window.pageYOffset;
                const yOffset = -40;
                window.scrollTo({
                    top: yCoordinate + yOffset,
                    behavior: 'smooth'
                });
            }
        }
    }
    if(oldActiveElement){
        oldActiveElement.classList.remove("active-song-container");
    }
    if(newActiveElement){
        newActiveElement.classList.add("active-song-container");
    }
    let imageUrl;
    document.querySelector(".main-cover").src = (imageUrl = song["cover"] !== null ? "/api/cover/" + song["cover"] + "/large" : "/img/no-cover.jpg");
    document.querySelector(".body-blur").style["background-image"] = "url("+ imageUrl +")";

    document.querySelector("#meta-container .song-name").textContent = song["title"];
    document.querySelector("#meta-container .song-album").textContent = song["album"];
    document.querySelector("#meta-container .song-artist").textContent = song["artist"];
    document.querySelector(".np-hash").textContent = song["hash"];

    document.querySelector("#np-tags.tag-area").innerHTML = "";

    tryLoadLyrics(song).then(async () => {
        const np = shuffle ? shuffledPlaylist[currentPlaylistIndex] : songPlaylist[currentPlaylistIndex];
        if(!("lyrics" in np)){
            const s = (await getSubtitles());
            s.stopSubtitles();
            s.hideSubtitles();
        }
    });

    let tagData = getTagEntries(song);
    applyTagEntries(document.querySelector("#np-tags.tag-area"), tagData.tags);

    pushMediaSessionMetadata(song);

    if (playing) {
        uplayer.play(true);
        pushPlayNotification(song, "player");
    }
}

playThisSong(songPlaylist[currentPlaylistIndex]);