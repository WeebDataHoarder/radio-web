
const logVolumeCoefficient = 100;

class UPlayer {

    constructor(options) {
        /*
        streaming: (bool) default false
        forceCodec: (bool) default false
        preload: (bool) default false
        volume: (float 0.0-1.0) default 1.0, linear scale
        muted: (bool) default false
        retry: (bool) default false
        crossorigin: (bool) default false
        on-end: (callback)
        on-pre-end: (callback)
        on-error: (callback)
        */
        this.options = options != null ? options : {};

        this.nativePlayback = null;
        this.playerObject = null;
        this.nativePreload = null;
        this.preloadObject = null;
        this.oldNativePlayback = null;
        this.oldPlayerObject = null;
        this.guessedFormats = [];
        this.formatIndex = null;
        this.currentUrl = null;
        this.readyToPlay = false;
        this.sentPreEndEvent = false;

        this.volume = this.linearVolumeToLog("volume" in this.options ? this.options["volume"] : 1.0);
        this.oldVolume = this.volume;
        this.muted = "muted" in this.options ? this.options["muted"] : false;
        this.retry = "retry" in this.options ? this.options["retry"] : false;
        this.retryTimer = null;
        this.totalDuration = 0;
        this.currentProgress = 0;
        this.bufferProgress = 0;

        if ("play-pause-element" in this.options) {
            this.options["play-pause-element"].addEventListener("click", this.playPause.bind(this));
        }

        if ("mediaSession" in navigator) {
            navigator.mediaSession.setActionHandler('play', () => {
                if (!this.readyToPlay) {
                    return;
                }
                if (!this.isPlaying()) {
                    this.play();
                }
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                if (this.isPlaying()) {
                    this.pause();
                }
            });
        }

        if ("mute-element" in this.options) {
            this.options["mute-element"].classList.remove("muted");
            this.options["mute-element"].classList.add("not-muted");
            this.options["mute-element"].addEventListener("click", () => {
                if (this.isMuted()) {
                    this.unmute();
                } else {
                    this.mute();
                }
            });
        }

        if ("volume-element" in this.options) {
            this.options["volume-element"].value = this.logVolumeToLinear(this.volume) * 100;

            const volumeChangeFunction = () => {
                this.volume = this.linearVolumeToLog(this.options["volume-element"].value / 100);
                if (this.playerObject !== null) {
                    this.playerObject.volume = this.nativePlayback ? this.volume : this.volume * 100;
                }
            };
            this.options["volume-element"].addEventListener("change", volumeChangeFunction);
            this.options["volume-element"].addEventListener("input", volumeChangeFunction);
        }

        if ("seek-element" in this.options) {
            const seekChangeFunction = () => {
                if (this.playerObject !== null) {
                    if (this.nativePlayback) {
                        this.playerObject.currentTime = this.totalDuration * (this.options["seek-element"].value / 100);
                    } else {
                        this.playerObject.seek(this.totalDuration * (this.options["seek-element"].value / 100) * 1000);
                    }
                }
            };
            this.options["seek-element"].addEventListener("change", seekChangeFunction);
            this.options["seek-element"].addEventListener("input", seekChangeFunction);
        }


        this.codecSupport = {
            "(AppleWebKit)((?!Chrom(ium|e)\/).)*$": () => {
                this.options.preload = true;
                return true;
            },
            "*": true
        };
        this.supportsCodecs = null;

        this.audioCodecs = [
            {
                "extensions": ["aac", "m4a", "mp4"],
                "format": ["audio/aac"],
                "softCodec": ["/js/player/codecs/aac.js"],
                "type": "lossy",
                "supported": {
                    "probably": {"*": true},
                    "maybe": {"*": true}
                },
                "info": {}
            },
            {
                "extensions": ["opus", "ogg"],
                "format": ["audio/ogg;codecs=opus", "audio/opus"],
                "softCodec": ["/js/player/codecs/ogg.js", "/js/player/codecs/opus.js"],
                "type": "lossy",
                "supported": {
                    "probably": {"*": true},
                    "maybe": {"*": true}
                },
                "info": {}
            },
            {
                "extensions": ["ogg"],
                "format": ["audio/ogg;codecs=vorbis", "audio/vorbis"],
                "softCodec": ["/js/player/codecs/ogg.js", "/js/player/codecs/vorbis.js"],
                "type": "lossy",
                "supported": {
                    "probably": {"*": true},
                    "maybe": {"*": true}
                },
                "info": {}
            },
            {
                "extensions": ["ogg"],
                "format": ["audio/ogg"],
                "softCodec": ["/js/player/codecs/ogg.js", "/js/player/codecs/vorbis.js", "/js/player/codecs/flac.js"],
                "type": "lossy",
                "supported": {
                    "probably": {"*": true},
                    "maybe": {"*": true}
                },
                "info": {}
            },
            {
                "extensions": ["mp3"],
                "format": ["audio/mpeg;codecs=mp3", "audio/mp3"],
                "softCodec": ["/js/player/codecs/mp3.js"],
                "type": "lossy",
                "supported": {
                    "probably": {"*": true},
                    "maybe": {"*": true}
                },
                "info": {}
            },
            {
                "extensions": ["flac"],
                "format": ["audio/flac", "audio/ogg;codecs=flac"],
                "softCodec": ["/js/player/codecs/ogg.js", "/js/player/codecs/flac.js"],
                "type": "lossless",
                "supported": {
                    "probably": {"*": true},
                    "maybe": {
                        "(AppleWebKit)((?!Chrom(ium|e)\/).)*$": () => {
                            return !("streaming" in this.options && this.options["streaming"]);
                        }, "*": true
                    }
                },
                "info": {}
            },
            {
                "extensions": ["alac", "m4a", "mp4", "caf"],
                "format": ["audio/alac"],
                "type": "lossless",
                "softCodec": ["/js/player/codecs/alac.js"],
                "supported": {
                    "probably": {"*": true},
                    "maybe": {"*": true}
                },
                "info": {}
            },
            {
                "extensions": ["wav", "wave"],
                "format": ["audio/wave", "audio/wav"],
                "type": "lossless",
                "softCodec": [],
                "supported": {
                    "probably": {"*": true},
                    "maybe": {"*": true}
                },
                "info": {}
            },
            {
                "extensions": ["aiff", "aif"],
                "format": ["audio/aiff"],
                "type": "lossless",
                "softCodec": [],
                "supported": {
                    "probably": {"*": true},
                    "maybe": {"*": true}
                },
                "info": {}
            },
            {
                "extensions": ["tta"],
                "format": ["audio/x-tta", "audio/tta"],
                "type": "lossless",
                "softCodec": ["/js/player/codecs/tta.js"],
                "supported": {
                    "probably": {"*": true},
                    "maybe": {"*": true}
                },
                "info": {}
            }
        ];
        this.checkBrowserCompatibility();
    }

    linearVolumeToLog(volume){
        if(volume < 0 || volume > 1){
            throw new Error("volume must be between 0 and 1 inclusive: " + volume);
        }

        return Math.max(0.0, Math.min(1.0, (Math.exp(Math.log(logVolumeCoefficient) * volume) - 1) / logVolumeCoefficient));
    }

    logVolumeToLinear(volume){
        if(volume < 0 || volume > 1){
            throw new Error("volume must be between 0 and 1 inclusive: " + volume);
        }
        return Math.max(0.0, Math.min(1.0, (Math.log(volume + 1 / logVolumeCoefficient) + Math.log(logVolumeCoefficient)) / Math.log(logVolumeCoefficient)));
    }

    playPause() {
        if (!this.readyToPlay) {
            return;
        }
        if (this.isPlaying()) {
            this.pause();
        } else {
            this.play();
        }
    }

    checkBrowserCompatibility() {
        let j;
        let check;
        for (check in this.codecSupport) {
            if (this.codecSupport.hasOwnProperty(check)) {
                if (check === '*' || navigator.userAgent.match(new RegExp(check)) !== null) {

                    if (typeof this.codecSupport[check] === "function") {
                        this.supportsCodecs = this.codecSupport[check]();
                    } else {
                        this.supportsCodecs = this.codecSupport[check];
                    }

                    if (!this.supportsCodecs) {
                        console.log("[UPlayer] This browser does not support software codecs.");
                    }
                    break;
                }
            }
        }

        console.log("[UPlayer] Checking which codecs can be played natively and loading codecs...");
        const audioTest = new Audio();
        const forceCodec = ("forceCodec" in this.options && this.options["forceCodec"]);
        for (let i = 0; i < this.audioCodecs.length; ++i) {
            const entry = this.audioCodecs[i];
            if (typeof audioTest.canPlayType === "function") {
                for (j = 0; j < entry.format.length; ++j) {
                    if ("playback" in this.audioCodecs[i]) {
                        break;
                    }
                    const result = audioTest.canPlayType(entry.format[j]);
                    if (result in entry.supported) {
                        for (check in entry.supported[result]) {
                            if (entry.supported[result].hasOwnProperty(check)) {
                                if (check === '*' || navigator.userAgent.match(new RegExp(check)) !== null) {
                                    if (typeof entry.supported[result][check] === "function") {
                                        this.audioCodecs[i].playback = entry.supported[result][check]() ? "native" : "";
                                    } else {
                                        this.audioCodecs[i].playback = entry.supported[result][check] ? "native" : "";
                                    }
                                    break;
                                }
                            }
                        }
                        if (!("playback" in this.audioCodecs[i])) {
                            this.audioCodecs[i].playback = "";
                        }
                    } else {
                        this.audioCodecs[i].playback = "";
                    }
                }
            } else {
                //Eh, who knows at this point
                this.audioCodecs[i].playback = "";
            }

            if (!forceCodec && this.audioCodecs[i].playback === "native") {
                console.log("[UPlayer] Browser can play " + entry.format + " natively.");
            } else if ("limitCodecs" in this.options && !this.options.limitCodecs.some(r => this.audioCodecs[i]["format"].indexOf(r) >= 0)) {
                //Just do nothing
            } else if ("softCodec" in this.audioCodecs[i] && this.supportsCodecs) {

                const codecsNeeded = this.audioCodecs[i].softCodec.length;
                if (codecsNeeded === 0) {
                    this.audioCodecs[i].playback = "codec";
                    console.log("[UPlayer] Browser has no native support for " + entry.format + ", providing via software codec.");
                } else {
                    console.log("[UPlayer] Browser has no native support for " + entry.format + ", loading software codec.");
                    for (j = 0; j < this.audioCodecs[i].softCodec.length; ++j) {
                        const codec = this.audioCodecs[i].softCodec[j];
                        const format = entry.format;
                        this.audioCodecs[i].playback = "codec";

                        (new Promise((resolve, reject) => {
                            const script = document.createElement('script');
                            document.body.appendChild(script);
                            script.onload = resolve;
                            script.onerror = reject;
                            script.async = true;
                            script.src = codec;
                        })).then(() => {
                            console.log("[UPlayer] Loaded codec " + codec + " for " + format);
                        });
                    }
                }

                if (this.audioCodecs[i].playback === "native" && 'mediaCapabilities' in navigator && typeof navigator.mediaCapabilities.decodingInfo === "function") {
                    navigator.mediaCapabilities.decodingInfo({
                        type: "file",
                        audio: {
                            contentType: this.audioCodecs[i].format[0],
                            channels: 2,
                        }
                    }).then((info) => {
                        if (info.supported) {
                            this.audioCodecs[i].info.concat(info);
                        }
                    });

                }
            } else {
                console.log("[UPlayer] Browser has no native or codec support for " + entry.format + ".");
            }
        }
    }

    init(url, formats) {
        this.clearCurrentPlayback(true);
        this.currentFormat = formats.length > 0 ? 0 : null;
        this.currentUrl = url;
        this.guessedFormats = formats;
        this.forceCodec = ("forceCodec" in this.options ? this.options["forceCodec"] : false);
        console.log("[UPlayer] Init playback of " + url + " with formats " + formats);

        for (let i = 0; i < this.guessedFormats.length; ++i) {
            const playbackType = this.canPlayType(this.guessedFormats[i]);
            if (playbackType === "native") {
                this.currentFormat = i;
                break;
            }
        }

        if ("play-pause-element" in this.options) {
            this.options["play-pause-element"].classList.remove("playing");
            this.options["play-pause-element"].classList.add("paused");
        }
        if ("preload" in this.options && this.options["preload"]) {
            this.tryToPlay(this.currentUrl, this.guessedFormats[this.currentFormat], this.forceCodec);
        }else{
            if ("on-ready" in this.options) {
                this.options["on-ready"]();
            }
            this.readyToPlay = true;
        }
    }

    tryNextFormat() {
        let tryFormatNext = this.currentFormat + 1;
        if (tryFormatNext >= (this.guessedFormats.length - 1)) {
            tryFormatNext = 0;
            //this.forceCodec = !this.forceCodec;
        }

        for (let i = tryFormatNext; i < this.guessedFormats.length; ++i) {
            const playbackType = this.canPlayType(this.guessedFormats[i]);
            if (playbackType !== "") {
                this.currentFormat = i;
                this.tryToPlay(this.currentUrl, this.guessedFormats[i], this.forceCodec);
                break;
            }
        }
    }

    tryRestartPlayer(error) {
        if (this.retryTimer !== null) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
        console.log("[UPlayer] Error, trying to restart stream");
        console.log(error);
        this.clearCurrentPlayback(true);

        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            this.tryToPlay(this.currentUrl, this.guessedFormats[this.currentFormat], this.forceCodec);
            this.play();
        }, 2000);
    }

    clearCurrentPlayback(stop) {
        if (this.playerObject !== null && stop) {
            if (this.nativePlayback) {
                this.playerObject.pause();
            } else {
                this.playerObject.stop();
            }
        }
        this.oldPlayerObject = this.playerObject;
        this.oldNativePlayback = this.nativePlayback;
        this.playerObject = null;
        this.readyToPlay = false;
        this.totalDuration = 0.0;
        this.currentProgress = 0.0;
        this.bufferProgress = 0.0;
        this.sentPreEndEvent = false;
        if ("duration-minutes-element" in this.options) {
            this.options["duration-minutes-element"].textContent = this.zeroPad(Math.floor(this.totalDuration / 60), 2);
        }
        if ("duration-seconds-element" in this.options) {
            this.options["duration-seconds-element"].textContent = this.zeroPad(Math.floor(this.totalDuration % 60), 2);
        }
        if ("progress-minutes-element" in this.options) {
            this.options["progress-minutes-element"].textContent = this.zeroPad(Math.floor((this.currentProgress * this.totalDuration) / 60), 2);
        }
        if ("progress-seconds-element" in this.options) {
            this.options["progress-seconds-element"].textContent = this.zeroPad(Math.floor((this.currentProgress * this.totalDuration) % 60), 2);
        }
        if (this.currentProgress >= 0.0 && this.currentProgress <= 1.0 && "progress-element" in this.options) {
            this.options["progress-element"].value = this.currentProgress;
        }
        if (this.bufferProgress >= 0.0 && this.bufferProgress <= 1.0 && "buffer-progress-element" in this.options) {
            this.options["buffer-progress-element"].value = this.bufferProgress;
        }
        if (this.currentProgress >= 0.0 && this.currentProgress <= 1.0 && "seek-element" in this.options) {
            this.options["seek-element"].value = this.currentProgress * 100;
        }

        if ("on-progress" in this.options) {
            this.options["on-progress"]();
        }
    }


    preload(url, guessedFormats, forceCodec = false) {
        let playbackType = null;
        for (let i = 0; i < guessedFormats.length; ++i) {
            playbackType = this.canPlayType(guessedFormats[i]);
            if (playbackType === "native" || playbackType === "codec") {
                break;
            }
        }

        if (forceCodec !== true && playbackType === "native") {
            this.nativePreload = true;
            this.preloadObject = new Audio();
            this.preloadObject.autoplay = false;
            this.preloadObject.preload = "auto";
            this.preloadObject.crossorigin = ("crossorigin" in this.options && this.options["crossorigin"]) ? "use-credentials" : "same-origin";
            this.preloadObject.volume = 0;
            this.preloadObject.muted = true;

            return new Promise((resolve, reject) => {
                this.preloadObject.addEventListener("error", reject);

                this.preloadObject.addEventListener("canplay", resolve);

                this.preloadObject.src = url;
                this.preloadObject.load();
            });
        } else if (playbackType === "codec" || forceCodec === true) {
            this.nativePreload = false;
            if ("streaming" in this.options && this.options["streaming"]) {
                this.preloadObject = new AV.Player(new AV.Asset(new FetchStreamingSource(url)));
            } else {
                this.preloadObject = AV.Player.fromURL(url);
            }

            this.preloadObject.volume = 0;

            return new Promise((resolve, reject) => {
                this.preloadObject.on("error", reject);

                this.preloadObject.on("ready", resolve);
                this.preloadObject.preload();
            });
        }

        return Promise.reject("failed to guess codec");
    }


    tryToPlay(url, currentFormat, forceCodec) {
        const playbackType = this.canPlayType(currentFormat);
        this.sentPreEndEvent = false;
        if (forceCodec !== true && playbackType === "native") {
            this.nativePlayback = true;
            if (this.oldPlayerObject !== null && this.oldNativePlayback === this.nativePlayback) {
                this.playerObject = this.oldPlayerObject;
            } else {
                this.playerObject = new Audio();
            }
            this.playerObject.autoplay = false;
            this.playerObject.preload = ("preload" in this.options && this.options["preload"]) ? "auto" : "none";
            this.playerObject.crossorigin = ("crossorigin" in this.options && this.options["crossorigin"]) ? "use-credentials" : "same-origin";
            this.playerObject.volume = this.volume;
            this.playerObject.muted = this.muted;

            if (this.playerObject !== this.oldPlayerObject) {
                this.playerObject.addEventListener("error", (e) => {
                    if (e.target.error === null) {
                        console.log(e);
                        return;
                    }
                    if ('mediaSession' in navigator) {
                        navigator.mediaSession.playbackState = "paused";
                    }
                    if ("play-pause-element" in this.options) {
                        this.options["play-pause-element"].classList.remove("playing");
                        this.options["play-pause-element"].classList.add("paused");
                    }
                    switch (e.target.error.code) {
                        case e.target.error.MEDIA_ERR_ABORTED:
                            //Paused/stopped
                            if ("on-error" in this.options) {
                                this.options["on-error"](e);
                            }
                            console.log("[UPlayer] MEDIA_ERR_ABORTED (" + e.target.error.code + ") when playing format " + this.guessedFormats[this.currentFormat] + ", trying to restart.");
                            if (this.retry && (this.playerObject.paused || this.playerObject.ended || this.playerObject.error != null)) {
                                this.tryRestartPlayer(e);
                            } else {
                                console.log("[UPlayer] Error: " + e);
                            }
                            break;
                        case e.target.error.MEDIA_ERR_NETWORK:
                            //Network error, retry?
                            if ("on-error" in this.options) {
                                this.options["on-error"](e);
                            }
                            console.log("[UPlayer] MEDIA_ERR_NETWORK (" + e.target.error.code + ") when playing format " + this.guessedFormats[this.currentFormat] + ", trying to restart.");
                            if (this.retry && (this.playerObject.paused || this.playerObject.ended || this.playerObject.error != null)) {
                                this.tryRestartPlayer(e);
                            } else {
                                console.log("[UPlayer] Error: " + e);
                            }
                            break;
                        case e.target.error.MEDIA_ERR_DECODE:
                            if ("on-error" in this.options) {
                                this.options["on-error"](e);
                            }
                            console.log("[UPlayer] MEDIA_ERR_DECODE (" + e.target.error.code + ") when playing format " + this.guessedFormats[this.currentFormat] + ", trying different method.");
                            this.retryTimer = setTimeout(() => {
                                this.retryTimer = null;
                                this.tryNextFormat();
                            }, 1000);
                            break;
                        case e.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                            if ("on-error" in this.options) {
                                this.options["on-error"](e);
                            }
                            console.log("[UPlayer] MEDIA_ERR_SRC_NOT_SUPPORTED (" + e.target.error.code + ") when playing format " + this.guessedFormats[this.currentFormat] + ", trying different method.");
                            this.retryTimer = setTimeout(() => {
                                this.retryTimer = null;
                                this.tryNextFormat();
                            }, 1000);
                            break;
                        default:
                            console.log(e);
                            break;
                    }
                });

                this.playerObject.addEventListener("play", () => {
                    if ('mediaSession' in navigator) {
                        navigator.mediaSession.playbackState = "playing";
                    }
                    if ("play-pause-element" in this.options) {
                        this.options["play-pause-element"].classList.remove("paused");
                        this.options["play-pause-element"].classList.add("playing");
                    }
                });

                this.playerObject.addEventListener("playing", () => {
                    if ('mediaSession' in navigator) {
                        navigator.mediaSession.playbackState = "playing";
                    }
                    if ("play-pause-element" in this.options) {
                        this.options["play-pause-element"].classList.remove("paused");
                        this.options["play-pause-element"].classList.add("playing");
                    }
                });

                this.playerObject.addEventListener("stalled", () => {
                    console.log("[UPlayer] Playback stalled.");
                    if ('mediaSession' in navigator) {
                        navigator.mediaSession.playbackState = "paused";
                    }
                    if ("play-pause-element" in this.options) {
                        this.options["play-pause-element"].classList.remove("playing");
                        this.options["play-pause-element"].classList.add("paused");
                    }
                });

                this.playerObject.addEventListener("ended", () => {
                    if ("on-end" in this.options) {
                        this.options["on-end"]();
                    }
                    if ('mediaSession' in navigator) {
                        navigator.mediaSession.playbackState = "paused";
                    }
                    if ("play-pause-element" in this.options) {
                        this.options["play-pause-element"].classList.remove("playing");
                        this.options["play-pause-element"].classList.add("paused");
                    }
                    if (this.retry) {
                        this.tryRestartPlayer("stream ended");
                    }
                });

                this.playerObject.addEventListener("canplay", (e) => {
                    //console.log(e);
                    this.readyToPlay = true;
                    if ("on-ready" in this.options) {
                        this.options["on-ready"]();
                    }
                    console.log("[UPlayer] Media is ready to play");
                });

                this.playerObject.addEventListener("loadedmetadata", (e) => {
                    //console.log(e);
                });

                this.playerObject.addEventListener("durationchange", (duration) => {
                    if (this.playerObject == null) {
                        return;
                    }
                    this.totalDuration = this.playerObject.duration;
                    if ("duration-minutes-element" in this.options) {
                        this.options["duration-minutes-element"].textContent = this.zeroPad(Math.floor(this.totalDuration / 60), 2);
                    }
                    if ("duration-seconds-element" in this.options) {
                        this.options["duration-seconds-element"].textContent = this.zeroPad(Math.floor(this.totalDuration % 60), 2);
                    }
                    if ("progress-minutes-element" in this.options) {
                        this.options["progress-minutes-element"].textContent = this.zeroPad(Math.floor((this.currentProgress * this.totalDuration) / 60), 2);
                    }
                    if ("progress-seconds-element" in this.options) {
                        this.options["progress-seconds-element"].textContent = this.zeroPad(Math.floor((this.currentProgress * this.totalDuration) % 60), 2);
                    }
                    if (this.currentProgress >= 0.0 && this.currentProgress <= 1.0 && "progress-element" in this.options) {
                        this.options["progress-element"].value = this.currentProgress;
                    }
                    if (this.currentProgress >= 0.0 && this.currentProgress <= 1.0 && "seek-element" in this.options) {
                        this.options["seek-element"].value = this.currentProgress * 100;
                    }

                    if ("on-progress" in this.options) {
                        this.options["on-progress"]();
                    }
                    this.checkSendPreEnd();
                });
                this.playerObject.addEventListener("progress", () => {
                    if (this.playerObject == null) {
                        return;
                    }
                    if (this.totalDuration > 0.0) {
                        this.bufferProgress = ((this.playerObject.buffered.length > 0 ? this.playerObject.buffered.end(0) : 0) / this.totalDuration);
                    }
                    if (this.bufferProgress >= 0.0 && this.bufferProgress <= 1.0 && "buffer-progress-element" in this.options) {
                        this.options["buffer-progress-element"].value = this.bufferProgress;
                    }
                });
                this.playerObject.addEventListener("timeupdate", () => {
                    if (this.playerObject == null) {
                        return;
                    }
                    if (this.totalDuration > 0.0) {
                        this.currentProgress = (this.playerObject.currentTime / this.totalDuration);
                    }
                    if ("progress-minutes-element" in this.options) {
                        this.options["progress-minutes-element"].textContent = this.zeroPad(Math.floor((this.currentProgress * this.totalDuration) / 60), 2);
                    }
                    if ("progress-seconds-element" in this.options) {
                        this.options["progress-seconds-element"].textContent = this.zeroPad(Math.floor((this.currentProgress * this.totalDuration) % 60), 2);
                    }
                    if (this.currentProgress >= 0.0 && this.currentProgress <= 1.0 && "progress-element" in this.options) {
                        this.options["progress-element"].value = this.currentProgress;
                    }
                    if (this.currentProgress >= 0.0 && this.currentProgress <= 1.0 && "seek-element" in this.options) {
                        this.options["seek-element"].value = this.currentProgress * 100;
                    }

                    if ("on-progress" in this.options) {
                        this.options["on-progress"]();
                    }
                    this.checkSendPreEnd();
                });
            }

            this.playerObject.src = this.currentUrl;

            if ("preload" in this.options && this.options["preload"]) {
                this.playerObject.load();
            }
        } else if (playbackType === "codec" || forceCodec == true) {
            this.nativePlayback = false;
            if ("streaming" in this.options && this.options["streaming"]) {
                this.playerObject = new AV.Player(new AV.Asset(new FetchStreamingSource(this.currentUrl)));
            } else {
                this.playerObject = AV.Player.fromURL(this.currentUrl);
            }

            this.playerObject.volume = this.volume * 100;

            this.playerObject.on("error", (e) => {
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = "paused";
                }
                if ("play-pause-element" in this.options) {
                    this.options["play-pause-element"].classList.remove("playing");
                    this.options["play-pause-element"].classList.add("paused");
                }
                if ("on-error" in this.options) {
                    this.options["on-error"](e);
                }
                if (this.retry) {
                    this.tryRestartPlayer(e);
                } else {
                    console.log("[UPlayer] Error: " + e);
                }
            });
            this.playerObject.on("end", () => {
                if ("on-end" in this.options) {
                    this.options["on-end"]();
                }
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = "paused";
                }
                if ("play-pause-element" in this.options) {
                    this.options["play-pause-element"].classList.remove("playing");
                    this.options["play-pause-element"].classList.add("paused");
                }
                if (this.retry) {
                    this.tryRestartPlayer("stream ended");
                }
            });

            this.playerObject.on("ready", () => {
                this.readyToPlay = true;
                if ("on-ready" in this.options) {
                    this.options["on-ready"]();
                }
                console.log("[UPlayer] Media is ready to play");
            });

            this.playerObject.on("format", (format) => {
                console.log(format);
            });
            this.playerObject.on("metadata", (metadata) => {
                console.log(metadata);
            });


            this.playerObject.on("duration", (duration) => {
                this.totalDuration = duration / 1000;
                if ("duration-minutes-element" in this.options) {
                    this.options["duration-minutes-element"].textContent = this.zeroPad(Math.floor(this.totalDuration / 60), 2);
                }
                if ("duration-seconds-element" in this.options) {
                    this.options["duration-seconds-element"].textContent = this.zeroPad(Math.floor(this.totalDuration % 60), 2);
                }
                if ("progress-minutes-element" in this.options) {
                    this.options["progress-minutes-element"].textContent = this.zeroPad(Math.floor((this.currentProgress * this.totalDuration) / 60), 2);
                }
                if ("progress-seconds-element" in this.options) {
                    this.options["progress-seconds-element"].textContent = this.zeroPad(Math.floor((this.currentProgress * this.totalDuration) % 60), 2);
                }
                if (this.currentProgress >= 0.0 && this.currentProgress <= 1.0 && "progress-element" in this.options) {
                    this.options["progress-element"].value = this.currentProgress;
                }
                if (this.currentProgress >= 0.0 && this.currentProgress <= 1.0 && "seek-element" in this.options) {
                    this.options["seek-element"].value = this.currentProgress * 100;
                }
                if ("on-progress" in this.options) {
                    this.options["on-progress"]();
                }
                this.checkSendPreEnd();
            });
            this.playerObject.on("buffer", (percent) => {
                this.bufferProgress = percent / 100;
                if (this.bufferProgress >= 0.0 && this.bufferProgress <= 1.0 && "buffer-progress-element" in this.options) {
                    this.options["buffer-progress-element"].value = this.bufferProgress;
                }
            });
            this.playerObject.on("progress", (time) => {
                if (this.totalDuration > 0.0) {
                    this.currentProgress = (time / 1000) / this.totalDuration;
                }
                if ("progress-minutes-element" in this.options) {
                    this.options["progress-minutes-element"].textContent = this.zeroPad(Math.floor((this.currentProgress * this.totalDuration) / 60), 2);
                }
                if ("progress-seconds-element" in this.options) {
                    this.options["progress-seconds-element"].textContent = this.zeroPad(Math.floor((this.currentProgress * this.totalDuration) % 60), 2);
                }
                if (this.currentProgress >= 0.0 && this.currentProgress <= 1.0 && "progress-element" in this.options) {
                    this.options["progress-element"].value = this.currentProgress;
                }
                if (this.currentProgress >= 0.0 && this.currentProgress <= 1.0 && "seek-element" in this.options) {
                    this.options["seek-element"].value = this.currentProgress * 100;
                }
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = "playing";
                }
                if ("play-pause-element" in this.options) {
                    this.options["play-pause-element"].classList.remove("paused");
                    this.options["play-pause-element"].classList.add("playing");
                }

                if ("on-progress" in this.options) {
                    this.options["on-progress"]();
                }
                this.checkSendPreEnd();
            });

            if ("preload" in this.options && this.options["preload"]) {
                this.playerObject.preload();
            }
        }

        this.oldPlayerObject = null;
        this.oldNativePlayback = null;
    }

    checkSendPreEnd() {
        const left = (this.totalDuration - this.currentProgress * this.totalDuration);
        if (!this.sentPreEndEvent && left <= 15 && left > 0 && "on-pre-end" in this.options) {
            this.sentPreEndEvent = true;
            this.options["on-pre-end"]();
        }
    }

    zeroPad(input, length) {
        return (Array(length + 1).join('0') + input).slice(-length);
    }

    resyncMediaToLoadedTrack() {
        if (this.playerObject === null) {
            return;
        }
        if (this.nativePlayback) {
            if (this.playerObject.buffered.length > 0) {
                this.playerObject.currentTime = Math.min(this.playerObject.buffered.start(0), this.playerObject.buffered.end(0) - 0.5);
            }
        }
    }

    play(force = false) {
        if (this.playerObject === null) {
            this.tryToPlay(this.currentUrl, this.guessedFormats[this.currentFormat], this.forceCodec);
        }

        if (this.nativePlayback) {
            if (!this.isPlaying() || force) {
                if (!this.readyToPlay) {
                    this.playerObject.load();
                }
                const promise = this.playerObject.play();
                if (promise !== undefined) {
                    promise.catch((error) => {
                        console.log(error);
                        // Auto-play was prevented
                        // Show a UI element to let the user manually start playback
                        if ("on-error" in this.options) {
                            this.options["on-error"](error);
                        }
                    }).then(() => {
                        if ('mediaSession' in navigator) {
                            navigator.mediaSession.playbackState = "playing";
                            if ("streaming" in this.options && this.options.streaming) {
                                this.resyncMediaToLoadedTrack();
                            }
                        }
                        // Auto-play started

                    });
                } else {
                    if ('mediaSession' in navigator) {
                        navigator.mediaSession.playbackState = "playing";
                    }
                    if ("streaming" in this.options && this.options.streaming) {
                        this.resyncMediaToLoadedTrack();
                    }
                }
            }
        } else {
            if (!this.isPlaying() || force) {
                this.playerObject.play();
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = "playing";
                }
                if ("streaming" in this.options && this.options.streaming) {
                    this.resyncMediaToLoadedTrack();
                }
            }
        }

        if ("play-pause-element" in this.options) {
            this.options["play-pause-element"].classList.remove("paused");
            this.options["play-pause-element"].classList.add("playing");
        }
    }

    isMuted() {
        return this.muted;
    }

    mute() {
        if (this.isMuted()) {
            return;
        }

        this.muted = true;
        this.oldVolume = this.volume;
        this.volume = 0.0;

        if ("mute-element" in this.options) {
            this.options["mute-element"].classList.remove("not-muted");
            this.options["mute-element"].classList.add("muted");
        }
        if (this.playerObject === null) {
            return;
        }
        this.playerObject.volume = 0.0;
        if (this.nativePlayback) {
            this.playerObject.muted = true;
        }
    }

    unmute() {
        if (!this.isMuted()) {
            return;
        }

        this.muted = false;
        this.volume = this.oldVolume;

        if ("mute-element" in this.options) {
            this.options["mute-element"].classList.remove("muted");
            this.options["mute-element"].classList.add("not-muted");
        }
        if (this.playerObject === null) {
            return;
        }
        this.playerObject.volume = this.volume;
        if (this.nativePlayback) {
            this.playerObject.muted = false;
        }
    }

    isPlaying() {
        if (this.playerObject === null) {
            return false;
        } else if ("playing" in this.playerObject) {
            return this.playerObject.playing;
        } else if ("paused" in this.playerObject) {
            return !this.playerObject.paused;
        }
        return false;
    }

    isPaused() {
        return !this.isPlaying();
    }

    pause() {
        if (this.playerObject === null) {
            return;
        }

        if (this.isPlaying()) {
            this.playerObject.pause();

            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = "paused";
            }
            if ("play-pause-element" in this.options) {
                this.options["play-pause-element"].classList.remove("playing");
                this.options["play-pause-element"].classList.add("paused");
            }
        }
    }


    canPlayExtension(toTest) {
        for (let i = 0; i < this.audioCodecs.length; ++i) {
            if (this.audioCodecs[i].extensions.includes(toTest)) {
                return this.audioCodecs[i].playback;
            }
        }

        return "";
    }

    getFormatsForExtension(ext) {
        const formats = [];
        for (let i = 0; i < this.audioCodecs.length; ++i) {
            if (this.audioCodecs[i].extensions.includes(ext)) {
                formats.push(this.audioCodecs[i].format[0]);
            }
        }

        return formats;
    }

    //MediaDecodingConfiguration
    decodingInfo(conf) {
        if ('type' in conf && (conf.type === 'file' || conf.type === 'media-source') && 'audio' in conf && 'contentType' in conf.audio) {
            for (let i = 0; i < this.audioCodecs.length; ++i) {
                if (this.audioCodecs[i].format.includes(conf.audio.contentType)) {
                    return {
                        supported: true,
                        smooth: 'smooth' in this.audioCodecs[i].info ? this.audioCodecs[i].smooth : true,
                        powerEfficient: 'powerEfficient' in this.audioCodecs[i].info ? this.audioCodecs[i].powerEfficient : (this.audioCodecs[i].playback === "codec" ? false : true),
                        playbackType: this.audioCodecs[i].playback
                    };
                }
            }
        }

        return {
            supported: false,
        };
    }

    canPlayType(toTest) {
        for (let i = 0; i < this.audioCodecs.length; ++i) {
            if (this.audioCodecs[i].format.includes(toTest)) {
                return this.audioCodecs[i].playback;
            }
        }

        return "";
    }
}

class FetchStreamingSource extends AV.EventEmitter {
    constructor(url, opts) {
        super()
        this.url = url;
        this.request = null;
        this.reader = null;
    }

    init() {
        this.request = fetch(this.url, {
            credentials: "include", //credentials: "same-origin",
            mode: "cors",
            headers: {
                "X-Requested-With": "UPlayer/FetchStreamingSource"
            }
        }).then((response) => {
            this.reader = response.body.getReader();
            this.reader.read().then(this.receiveChunk.bind(this)).catch((err) => {
                this.emit("error", err);
            });
        }).catch((err) => {
            this.emit("error", err);
        });
    }

    receiveChunk(result) {
        if (!this.reader) {
            return;
        }
        if (result.done) {
            this.emit("end");
            this.reader.cancel();
            return;
        }
        this.emit("data", new AV.Buffer(result.value));
        this.reader.read().then(this.receiveChunk.bind(this)).catch((err) => {
            this.emit("error", err);
        });
    }

    start() {
        if (this.request == null) {
            this.init();
        }
    }

    pause() {
        if (this.request != null) {
            if (this.reader != null) {
                this.reader.cancel().catch((err) => {

                });
                this.reader = null;
            }
            //this.request.close();
            this.request = null;
        }
    }

    reset() {
        /*if(this.request != null){
          this.request.cancel();
        }*/
    }
}
