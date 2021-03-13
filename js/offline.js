let kuroshiro = null;
let kuroshiroInit = null;

let subtitles = null;
let subtitlesTimer = null;

let shuffledPlaylist = [];

function resizeSubtitlesToMatchCanvas(timeout = true){
    if(subtitles === null){
        return;
    }
    const canvas = document.getElementById("lyrics-area");
    const ar = canvas.getAttribute("aspect-ratio");
    const canvasStyles = window.getComputedStyle(canvas);
    const width = canvasStyles.width.replace(/px$/, "");
    let height = canvasStyles.height.replace(/px$/, "");
    if(ar){
        const newHeight = String(Math.ceil(width / parseFloat(ar)));
        if(newHeight !== height){
            canvas.style.top = "-" + newHeight + "px";
            canvas.style.height = newHeight + "px";
            height = newHeight;
        }
    }

    const pixelRatio = "devicePixelRatio" in window ? window.devicePixelRatio : 1;
    subtitles.resize(width * pixelRatio, height * pixelRatio, 0, 0);

}

document.addEventListener("fullscreenchange", resizeSubtitlesToMatchCanvas, false);
document.addEventListener("mozfullscreenchange", resizeSubtitlesToMatchCanvas, false);
document.addEventListener("webkitfullscreenchange", resizeSubtitlesToMatchCanvas, false);
document.addEventListener("msfullscreenchange", resizeSubtitlesToMatchCanvas, false);
window.addEventListener("resize", resizeSubtitlesToMatchCanvas, false);


const baseApiUrl = window.localStorage.getItem("radio-api-url") != null ? window.localStorage.getItem("radio-api-url") : location.protocol + '//' + document.domain + ':' + location.port;
let currentLyrics = null;

let showOriginalLyrics = !!(window.localStorage.getItem("lyrics-original") !== null ? parseInt(window.localStorage.getItem("lyrics-original")) : 0);
const loadLyrics = !!(window.localStorage.getItem("lyrics-show") !== null ? parseInt(window.localStorage.getItem("lyrics-show")) : 1);
const lyricsAnimationLevel = (window.localStorage.getItem("lyrics-animations") !== null ? parseInt(window.localStorage.getItem("lyrics-animations")) : 1); // 0 = no, 1 = all, 2 = only fade in/out

let playing = false;
const urlParams = new URLSearchParams(window.location.search);

let index;
let currentPlaylistIndex;
let repeat;
let shuffle;
const seekElement = jQuery(".radio-song-slider");
const uplayer = new UPlayer({
    "volume": window.localStorage.getItem("radio-volume") !== null ? window.localStorage.getItem("radio-volume") / 100 : 1.0,
    "preload": true,
    //"streaming": true,
    "forceCodec": urlParams.get("forceCodec") !== null ? true : navigator.userAgent.match(/(Macintosh|iOS|iPad|iPhone)((?!Chrom(ium|e)\/).)*$/) !== null,
    "muted": false,
    "retry": false,
    "limitCodecs": limitCodecs,
    "play-pause-element": jQuery(".play-pause"),
    "progress-minutes-element": jQuery(".radio-current-minutes"),
    "progress-seconds-element": jQuery(".radio-current-seconds"),
    "duration-minutes-element": jQuery(".radio-duration-minutes"),
    "duration-seconds-element": jQuery(".radio-duration-seconds"),
    "progress-element": jQuery(".radio-song-played-progress"),
    "seek-element": seekElement,
    "buffer-progress-element": jQuery(".radio-buffered-progress"),
    "mute-element": jQuery(".mute"),
    "volume-element": jQuery(".volume-slider"),
    "on-end": function () {
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
        const currentTime = uplayer.currentProgress * uplayer.totalDuration;
        if (subtitles !== null) {
            subtitles.setCurrentTime(currentTime);
        }
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setPositionState({
                duration: uplayer.totalDuration,
                playbackRate: 1.0,
                position: currentTime
            });
        }
    }
});


jQuery(".volume-slider").on("change", function () {
    window.localStorage.setItem("radio-volume", jQuery(this).val());
});

jQuery("#lyrics-area").on("click", () => {
    showOriginalLyrics = !showOriginalLyrics;
    window.localStorage.setItem("lyrics-original", showOriginalLyrics ? 1 : 0);
    if(currentLyrics !== null){
        if(currentLyrics.type === "timed"){
            createSubtitleFromEntries(currentLyrics.entries);
        }else if(currentLyrics.type === "ass"){

        }
    }
});


const songElement = jQuery("div#radio-right").clone();
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
            songElement.append("<hr/>");
        }

        songElement.append('<div class="album-header">' + data["album"] + '</div>');
    }
    songElement.append('<div class="song radio-song-container" song-index="' + index + '" song-hash="' + data["hash"] + '">' +
        '<div class="queue-fit"><img data-src="' + (data["cover"] !== null ? "/api/cover/" + data["cover"] + "/small" : "/img/no-cover.jpg") + '" class="queue-cover"/></div>' +
        '<div class="song-now-playing-icon-container">' +
        '<div class="play-button-container">' +
        '</div>' +
        '<img class="now-playing" src="/img/now-playing.svg"/>' +
        '</div>' +
        '<div class="song-meta-data">' +
        '<span class="song-title">' + document.createTextNode(data["title"]).data + '</span>' +
        '<span class="song-artist">' + document.createTextNode(data["artist"]).data + '</span>' +
        '<span class="song-album">' + document.createTextNode(data["album"]).data + '</span>' +
        '</div>' +
        '<span class="song-duration">' + uplayer.zeroPad(Math.floor(data["duration"] / 60), 2) + ':' + uplayer.zeroPad(data["duration"] % 60, 2) + '</span>' +
        '</div>');
    prevData = data;
}
jQuery("div#radio-right").replaceWith(songElement);

document.addEventListener("DOMContentLoaded", function() {
    const lazyImages = [].slice.call(document.querySelectorAll(".queue-cover"));

    if ("IntersectionObserver" in window) {
        let lazyImageObserver = new IntersectionObserver(function(entries, observer) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.src = entry.target.getAttribute("data-src");
                    lazyImageObserver.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: '250px'
        });

        lazyImages.forEach(function(lazyBackground) {
            lazyImageObserver.observe(lazyBackground);
        });
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
jQuery(".radio-repeat").addClass("repeat-off");
jQuery(".radio-shuffle").addClass("shuffle-off");

jQuery(".radio-repeat").on("click", function () {
    if (repeat) {
        repeat = false;
        jQuery(".radio-repeat").removeClass("repeat-on");
        jQuery(".radio-repeat").addClass("repeat-off");
    } else {
        repeat = true;
        jQuery(".radio-repeat").removeClass("repeat-off");
        jQuery(".radio-repeat").addClass("repeat-on");
    }
});

jQuery(".radio-shuffle").on("click", function () {
    if (shuffle) {
        shuffle = false;
        jQuery(".radio-shuffle").removeClass("shuffle-on");
        jQuery(".radio-shuffle").addClass("shuffle-off");
    } else {
        shuffle = true;
        jQuery(".radio-shuffle").removeClass("shuffle-off");
        jQuery(".radio-shuffle").addClass("shuffle-on");
        shuffledPlaylist = songPlaylist.slice();
        shuffleArray(shuffledPlaylist);
    }
});

jQuery(".hash-area").on('click', function () {
    const temp = jQuery("<input>");
    jQuery("body").append(temp);
    temp.val(jQuery(this).text()).select();
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

jQuery(".radio-next").on("click", nextSong);
jQuery(".radio-prev").on("click", previousSong);

try{
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('nexttrack', nextSong);
        navigator.mediaSession.setActionHandler('previoustrack', previousSong);
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
            seekElement.val((Math.min(uplayer.totalDuration, Math.max(0, uplayer.currentProgress * uplayer.totalDuration - (details.seekOffset || 30))) / uplayer.totalDuration) * 100).trigger("change");
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
            seekElement.val((Math.min(uplayer.totalDuration, Math.max(0, uplayer.currentProgress * uplayer.totalDuration + (details.seekOffset || 30))) / uplayer.totalDuration) * 100).trigger("change");
        });
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            seekElement.val((Math.min(uplayer.totalDuration, Math.max(0, details.seekTime)) / uplayer.totalDuration) * 100).trigger("change");
        });
    }
}catch (e){
    console.log(e);
}


jQuery(".radio-song-container").on("click", function () {
    currentPlaylistIndex = parseInt($(this).attr("song-index"));
    playThisSong(songPlaylist[currentPlaylistIndex]);
});


function preloadThisSong(song, isPlaying = null) {
    console.log("Trying to preload next track " + song["url"]);
    uplayer.preload(song["url"], [song["mime"]]).then(e => {
        console.log("preloaded next song!");
    }).catch(e => {
        console.log("failed to preload: ");
        console.log(e);
    });
}

function loadKuroshiro(){
    if(kuroshiro === null){
        kuroshiro = new Kuroshiro();
        return kuroshiroInit = kuroshiro.init(new KuromojiAnalyzer({
            dictPath: "/dict/"
        }));
    }else{
        return kuroshiroInit;
    }
}

function loadLRCLyrics(data){
    resizeSubtitlesToMatchCanvas();

    currentLyrics = null;

    const lyricEntries = [];

    let lines = data.split("\n");
    let currentOffset = 0;
    let previousEntry = null;
    lines.forEach((line) => {
        let matches = line.match(/\[(offset):([^\]]+)\]/);
        if(matches !== null){
            const type = matches[1].toLowerCase();
            const content = matches[2].trim();
            if(type === "offset"){
                currentOffset = parseFloat(content) / 1000;
            }
        }else{
            matches = line.match(/\[([^\]]+)\](.*)/);
            if(matches !== null){
                const text = matches[2].trim();
                const timeUnits = matches[1].split(":");
                let time = parseFloat(timeUnits.pop()) || 0;
                time += (parseFloat(timeUnits.pop()) * 60) || 0;
                time += (parseFloat(timeUnits.pop()) * 3600) || 0;
                time += currentOffset;

                if(text.match(/^(作词|作曲|编曲|曲|歌|词)[ \t]*[：∶:]/)){
                    return;
                }

                /*if(previousEntry === null && text === ""){
                    continue;
                }else */if(previousEntry !== null && !previousEntry.end){
                    if(previousEntry.text === "" && text === ""){
                        return;
                    }
                    previousEntry.end = time;
                }

                const subEntries = [];

                const regex = /<([0-9:. ]+)>([^<]*)/g;
                let result;
                let prevSubEntry = null;
                while((result = regex.exec(text)) !== null){
                    const subText = result[2];
                    const subTimeUnits = result[1].split(":");
                    let subTime = parseFloat(String(subTimeUnits.pop()).trim()) || 0;
                    subTime += (parseFloat(String(subTimeUnits.pop()).trim()) * 60) || 0;
                    subTime += (parseFloat(String(subTimeUnits.pop()).trim()) * 3600) || 0;
                    subTime += currentOffset;

                    if(prevSubEntry !== null && !prevSubEntry.end){
                        prevSubEntry.end = subTime;
                    }

                    subEntries.push(prevSubEntry = {
                        text: subText,
                        start: subTime
                    });

                }

                lyricEntries.push(previousEntry = {
                    text: text.replace(/<[^>]+>/g, ""),
                    start: time
                });
                if(subEntries.length > 0){
                    previousEntry.entries = subEntries;
                }
            }
        }
    });

    const promises = [];

    lyricEntries.forEach((lyricEntry) => {
        if(Kuroshiro.Util.hasJapanese(lyricEntry.text)){
            const currentObject = lyricEntry;
            if(currentObject.entries){
                for(let k = 0; k < currentObject.entries.length; ++k){
                    const currentObjectIndex = k;
                    promises.push(convertJapaneseToRomaji(currentObject.entries[currentObjectIndex].text).then((result) => {
                        currentObject.entries[currentObjectIndex].originalText = currentObject.entries[currentObjectIndex].text;
                        currentObject.entries[currentObjectIndex].text = result + " ";
                    }));
                }
            }

            promises.push(convertJapaneseToRomaji(currentObject.text).then((result) => {
                currentObject.originalText = currentObject.text;
                currentObject.text = result;
            }));
        }
    })

    Promise.all(promises).then(() => {
        currentLyrics = {
            type: "timed",
            entries: lyricEntries
        }

        createSubtitleFromEntries(lyricEntries);
    });
}

function convertJapaneseToRomaji(text){
    return new Promise((resolve, reject) => {
        loadKuroshiro().then(() => {
            kuroshiro.convert(text, {
                to: "romaji",
                mode: "spaced",
                romajiSystem: "hepburn"
            }).then((result) => {
                resolve(result)
            }).catch((e) => {
                console.log(e);
                resolve(text)
            });
        });
    })
}

function decodeASSEntry(input){
    let output = new Uint8Array(input.length);
    let grouping = new Uint8Array(4);

    let offset = 0;
    let arrayOffset = 0;
    let writeOffset = 0;
    let charCode;
    while (offset < input.length){
        charCode = input.charCodeAt(offset++);
        if(charCode >= 0x21 && charCode <= 0x60){
            grouping[arrayOffset++] = charCode - 33;
            if(arrayOffset === 4){
                output[writeOffset++] = (grouping[0] << 2) | (grouping[1] >> 4);
                output[writeOffset++] = ((grouping[1] & 0xf) << 4) | (grouping[2] >> 2);
                output[writeOffset++] = ((grouping[2] & 0x3) << 6) | (grouping[3]);
                //charCode = (grouping[0] << 18) | (grouping[1] << 12) | (grouping[2] << 6) | grouping[3];
                //output[writeOffset++] = (charCode >> 16) & 0xff;
                //output[writeOffset++] = (charCode >> 8) & 0xff;
                //output[writeOffset++] = charCode & 0xff;
                arrayOffset = 0;
            }
        }
    }

    //Handle ASS special padding
    if(arrayOffset > 0){
        if(arrayOffset === 2){
            output[writeOffset++] = ((grouping[0] << 6) | grouping[1]) >> 4;
        }else if(arrayOffset === 3){
            let ix = ((grouping[0] << 12) | (grouping[1] << 6) | grouping[2]) >> 2;
            output[writeOffset++] = ix >> 8;
            output[writeOffset++] = ix & 0xff;
        }
    }

    return output.slice(0, writeOffset);
}

function createSubtitlesInstance(subsContent){
    if(subtitles !== null){
        subtitles.dispose();
        subtitles = null;
    }

    const fonts = {
        "open sans": "/fonts/OpenSans-Regular.ttf",
        "open sans regular": "/fonts/OpenSans-Regular.ttf",

        "open sans semibold": "/fonts/OpenSans-SemiBold.ttf",

        "noto sans": "/fonts/NotoSansCJK-Regular.ttc",
        "noto sans cjk": "/fonts/NotoSansCJK-Regular.ttc",
        "noto sans cjk jp": "/fonts/NotoSansCJK-Regular.ttc",
        "noto sans regular": "/fonts/NotoSansCJK-Regular.ttc",
        "noto sans cjk regular": "/fonts/NotoSansCJK-Regular.ttc",

        "noto sans bold": "/fonts/NotoSansCJK-Bold.ttc",
        "noto sans cjk bold": "/fonts/NotoSansCJK-Bold.ttc",

        "arial": "/fonts/arial.ttf",
        "arial regular": "/fonts/arial.ttf",

        "arial bold": "/fonts/arialbd.ttf",

        "arial rounded mt bold": "/fonts/ARLRDBD.TTF",

        "dfkai-sb": "/fonts/kaiu.ttf",

        "franklin gothic book": "/fonts/frabk.ttf",
        "franklin gothic book regular": "/fonts/frabk.ttf"
    };

    const promises = [];

    let regex = /^fontnamev2:[ \t]*([^_]+)_([^,]*)\.([a-z0-9]{3,5}),[ \t]*(.+)$/mg;
    let result;
    while((result = regex.exec(subsContent)) !== null){
        const fontName = result[1];
        const fontProperties = result[2];
        const fontExtension = result[3];
        fonts[fontName.toLowerCase()] = result[4];
    }

    regex = /^fontname:[ \t]*([^_]+)_([^$]*)\.([a-z0-9]{3,5})((?:\r?\n[\x21-\x60]+)+)/mg;
    while((result = regex.exec(subsContent)) !== null){
        const currentResult = result;
        promises.push(new Promise(((resolve, reject) => {
            const fontName = currentResult[1];
            const fontProperties = currentResult[2];
            const fontExtension = currentResult[3];
            const blob = new Blob([decodeASSEntry(currentResult[4])], {type: "application/font-" + fontExtension.toLowerCase()});
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.addEventListener("load", function () {
                fonts[fontName.toLowerCase()] = reader.result;
                resolve();
            }, false);
        })));
    }

    Promise.all(promises).then(() => {
        const canvas = document.getElementById("lyrics-area");

        const resolutionInformation = {
            aspectRatio: 10.6666667//1.777778
        };
        result = subsContent.match(/^PlayResX:[ \t]*([0-9]+)$/m);
        if(result !== null){
            resolutionInformation.x = parseInt(result[1]);
        }
        result = subsContent.match(/^PlayResY:[ \t]*([0-9]+)$/m);
        if(result !== null){
            resolutionInformation.y = parseInt(result[1]);
        }
        if(resolutionInformation.x && resolutionInformation.y){
            resolutionInformation.aspectRatio = resolutionInformation.x / resolutionInformation.y;
        }

        canvas.setAttribute("aspect-ratio", resolutionInformation.aspectRatio);
        result = subsContent.match(/^CanvasBackground:[ \t]*&H([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/m);

        let alpha = 0.4;
        let blue = 0;
        let green = 0;
        let red = 0;

        if(result !== null){
            alpha = parseInt(result[1], 16) / 255;
            blue = parseInt(result[2], 16) / 255;
            green = parseInt(result[3], 16) / 255;
            red = parseInt(result[4], 16) / 255;
        }
        canvas.style["background-color"] = "rgba("+red+", "+green+", "+blue+", "+alpha+")";

        if(subtitles !== null){
            subtitles.dispose();
        }
        subtitles = new SubtitlesOctopus({
            canvas: canvas,
            renderMode: typeof createImageBitmap !== 'undefined' ? "fast" : "normal",
            //renderMode: "blend",
            workerUrl: "/js/subtitles/subtitles-octopus-worker.js",
            legacyWorkerUrl: "/js/subtitles/subtitles-octopus-worker-legacy.js",
            availableFonts: fonts,
            subContent: subsContent,
            targetFps: 30,
            resizeVariation: 0.1,
            libassMemoryLimit: 40,
            libassGlyphLimit: 40,
            //renderAhead: 30,
            dropAllAnimations: lyricsAnimationLevel == 0,
            onReady: () => {
                resizeSubtitlesToMatchCanvas(false);
            }
        });
        if(uplayer.playerObject !== null){
            if(uplayer.nativePlayback){
                subtitles.setCurrentTime(uplayer.playerObject.currentTime);
            }else{
                subtitles.setCurrentTime(uplayer.playerObject.currentTime / 1000);
            }
        }else{
            subtitles.setCurrentTime(0);
        }


        const updateFps = 30;

        if(subtitlesTimer !== null){
            clearInterval(subtitlesTimer);
        }
        subtitlesTimer = setInterval(() => {
            if(subtitles !== null && currentLyrics !== null && uplayer.isPlaying()){
                if(uplayer.nativePlayback){
                    subtitles.setCurrentTime(uplayer.playerObject.currentTime);
                }else{
                    subtitles.setCurrentTime(uplayer.playerObject.currentTime / 1000);
                }
            }
        }, Math.floor(1 / updateFps * 1000));
        resizeSubtitlesToMatchCanvas(false);
    });
}

function createSubtitleFromEntries(lyricEntries){
    let subtitleFile = '[Script Info]\n' +
        'Title: Lyrics\n' +
        'ScriptType: v4.00+\n' +
        'Collisions: Normal\n' +
        'WrapStyle: 0\n' +
        'ScaledBorderAndShadow: yes\n' +
        'YCbCr Matrix: None\n' +
        'PlayResX: 512\n' +
        'PlayResY: 52\n' +
        'Timer: 100.0000\n' +
        'PlayDepth: 0\n' +
        'CanvasBackground: &H66000000\n' +
        '\n' +
        '[Aegisub Project Garbage]\n' +
        'Last Style Storage: Default\n' +
        'Video File: ?dummy:23.976000:40000:512:52:47:163:254:\n' +
        'Video AR Value: 5.000000\n' +
        '\n' +
        '[V4+ Styles]\n' +
        'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n' +
        'Style: Current,Open Sans,24,&H00FFFFFF,&H00B1B1B1,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,1,0,5,5,5,0,1\n' +
        '\n' +
        '[Events]\n' +
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
    const previousEntry = {
        text: "",
        start: 0,
        end: lyricEntries[0] ? lyricEntries[0].start : 0
    };

    const timeToStamp = (time) => {
        time = Math.max(time, 0);
        const hours = Math.floor(time / 3600);
        time = time - hours * 3600;
        const minutes = Math.floor(time / 60);
        const seconds = time - minutes * 60;

        function str_pad_left(string, pad, length) {
            return (new Array(length + 1).join(pad) + string).slice(-length);
        }

        return hours + ":" + str_pad_left(minutes, '0', 2) + ':' + str_pad_left(Math.floor(seconds), '0', 2) + "." + str_pad_left(Math.round((seconds - Math.floor(seconds)) * 100), '0', 2);
    };

    const pickText = (ob) => {
        return ((showOriginalLyrics && ob.originalText) ? ob.originalText : ob.text).replace(/[ ]+/g, ' ');
    };

    subtitleFile += 'Dialogue: 0,0:00:00.00,0:00:05.00,Current,,0,0,0,,{\\pos(1,1)\\alpha&FF}WARMUP\n'; //Do this to "pre-render"
    subtitleFile += 'Dialogue: 0,0:00:05.00,0:00:15.00,Current,,0,0,0,,{\\pos(1,1)\\alpha&FF}WARMUP\n'; //Do this to "pre-render"

    for(let i = 0; i < lyricEntries.length; ++i){
        const line = lyricEntries[i];
        //TODO: secondary line

        let entryLine = 'Dialogue: 1,' + timeToStamp(line.start) + ', ' + timeToStamp(line.end !== undefined ? line.end : line.start + 5) + ',Current,,0,0,0,,';
        const lineDuration = Math.max(1, Math.floor(((line.end !== undefined ? line.end : line.start + 5) - line.start) * 100));
        if(line.entries && line.entries.length > 0){
            entryLine += ((lyricsAnimationLevel > 0 && lineDuration > 50) ? '{\\fade(50,250)}' : '');
            for(let k = 0; k < line.entries.length; ++k){
                const entry = line.entries[k];
                const entryDuration = Math.max(1, Math.floor(((entry.end !== undefined ? Math.min(line.end !== undefined ? line.end : entry.end, entry.end) : (line.end !== undefined ? line.end : line.start + 5)) - entry.start) * 100));
                entryLine += (lyricsAnimationLevel > 0 ? (lyricsAnimationLevel === 1 ? '{\\kf'+entryDuration+'}' : '{\\k'+entryDuration+'}') : '') + pickText(entry);
            }
        }else{
            const txt = pickText(line);
            if(txt.trim() === ""){
                continue;
            }
            entryLine += '{'+(lineDuration > 50 ? '\\fade(50,250)' : '')+  (lyricsAnimationLevel > 0 ? (lyricsAnimationLevel === 1 ? '\\kf' + lineDuration : '\\k' + lineDuration) : '') + '}' + txt;
        }

        subtitleFile += entryLine + '\n';
    }
    createSubtitlesInstance(subtitleFile);

    return subtitleFile;
}

function tryLoadLyrics(song){
    if(loadLyrics){
        const preferredLyrics = ["ass", "timed"];
        let subtitleEntry = null;

        for(let index = 0; index < preferredLyrics.length; ++index){
            if('lyrics' in song && song.lyrics.includes(preferredLyrics[index])){
                subtitleEntry = preferredLyrics[index];

                jQuery.ajax(baseApiUrl + "/api/info/" + song.hash + "/lyrics/" + subtitleEntry, {
                    method: "GET",
                    async: true
                }).done(function (data, status, xhr) {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        if(typeof data === "string"){
                            if(subtitleEntry === "timed"){
                                loadLRCLyrics(data);
                            }else if(subtitleEntry === "ass"){
                                currentLyrics = {
                                    type: "ass",
                                    entries: data
                                }
                                createSubtitlesInstance(data);
                            }
                        }
                    }
                });

                return;
            }
        }
    }


    if(subtitlesTimer !== null){
        clearInterval(subtitlesTimer);
        subtitlesTimer = null;
    }

    jQuery("#lyrics-area").css("height", "0px");
    jQuery("#lyrics-area").css("top", "-0px");

}

function playThisSong(song, isPlaying = null) {
    if (isPlaying === null) {
        playing = uplayer.isPlaying();
    } else {
        playing = isPlaying;
    }

    uplayer.init(song["url"], [song["mime"]]);
    const oldActiveElement = jQuery(".active-song-container");
    const newActiveElement = jQuery(".song[song-hash=\"" + song["hash"] + "\"]");
    if (oldActiveElement.length > 0 && newActiveElement.length > 0) {
        const oldBounds = oldActiveElement[0].getBoundingClientRect();
        if ((oldBounds.top >= 0 && oldBounds.bottom <= window.innerHeight) || (oldBounds.top < window.innerHeight && oldBounds.bottom >= 0)) {
            let newBounds = newActiveElement[0].getBoundingClientRect();
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
    oldActiveElement.removeClass("active-song-container");
    newActiveElement.addClass("active-song-container");
    let imageUrl;
    jQuery(".main-cover").attr("src", imageUrl = song["cover"] !== null ? "/api/cover/" + song["cover"] + "/large" : "/img/no-cover.jpg");
    jQuery(".body-blur").css("background-image", "url("+ imageUrl +")");

    jQuery("#meta-container .song-name").html(song["title"]);
    jQuery("#meta-container .song-album").html(song["album"]);
    jQuery("#meta-container .song-artist").html(song["artist"]);
    jQuery(".np-hash").text(song["hash"]);

    jQuery("#np-tags.tag-area").html("");

    tryLoadLyrics(song);

    let tagData = getTagEntries(song);
    applyTagEntries(jQuery("#np-tags.tag-area").get(0), tagData.tags);

    pushMediaSessionMetadata(song);

    if (playing) {
        uplayer.play(true);
        pushPlayNotification(song, "player");
    }
}

playThisSong(songPlaylist[currentPlaylistIndex]);