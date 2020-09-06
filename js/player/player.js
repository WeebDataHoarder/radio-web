class UPlayer {
    constructor(options) {
        /*
        streaming: (bool) default false
        forceCodec: (bool) default false
        preload: (bool) default false
        volume: (float 0.0-1.0) default 1.0
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

        this.volume = "volume" in this.options ? this.options["volume"] : 1.0;
        this.oldVolume = this.volume;
        this.muted = "muted" in this.options ? this.options["muted"] : false;
        this.retry = "retry" in this.options ? this.options["retry"] : false;
        this.retryTimer = null;
        this.totalDuration = 0;
        this.currentProgress = 0;
        this.bufferProgress = 0;

        if ("play-pause-element" in this.options) {
            $(this.options["play-pause-element"]).on("click", this.playPause.bind(this));
        }

        if ("mediaSession" in navigator) {
            navigator.mediaSession.setActionHandler('play', function () {
                if (!this.readyToPlay) {
                    return;
                }
                if (!this.isPlaying()) {
                    this.play();
                }
            }.bind(this));
            navigator.mediaSession.setActionHandler('pause', function () {
                if (this.isPlaying()) {
                    this.pause();
                }
            }.bind(this));
        }

        if ("mute-element" in this.options) {
            this.options["mute-element"].removeClass("muted");
            this.options["mute-element"].addClass("not-muted");
            $(this.options["mute-element"]).on("click", function () {
                if (this.isMuted()) {
                    this.unmute();
                } else {
                    this.mute();
                }
            }.bind(this));
        }

        if ("volume-element" in this.options) {
            $(this.options["volume-element"]).val(this.volume * 100);
            $(this.options["volume-element"]).on("change", function () {
                if (this.playerObject !== null) {
                    this.volume = $(this.options["volume-element"]).val() / 100;
                    this.playerObject.volume = this.nativePlayback ? this.volume : this.volume * 100;
                }
            }.bind(this));
            $(this.options["volume-element"]).on("input", function () {
                if (this.playerObject !== null) {
                    this.volume = $(this.options["volume-element"]).val() / 100;
                    this.playerObject.volume = this.nativePlayback ? this.volume : this.volume * 100;
                }
            }.bind(this));
        }

        if ("seek-element" in this.options) {
            $(this.options["seek-element"]).on("change", function () {
                if (this.playerObject !== null) {
                    if (this.nativePlayback) {
                        this.playerObject.currentTime = this.totalDuration * ($(this.options["seek-element"]).val() / 100);
                    } else {
                        this.playerObject.seek(this.totalDuration * ($(this.options["seek-element"]).val() / 100) * 1000);
                    }
                }
            }.bind(this));
            $(this.options["seek-element"]).on("input", function () {
                if (this.playerObject !== null) {
                    if (this.nativePlayback) {
                        this.playerObject.currentTime = this.totalDuration * ($(this.options["seek-element"]).val() / 100);
                    } else {
                        this.playerObject.seek(this.totalDuration * ($(this.options["seek-element"]).val() / 100) * 1000);
                    }
                }
            }.bind(this));
        }


        this.codecSupport = {
            "(Macintosh|iOS|iPad|iPhone)((?!Chrom(ium|e)/).)*$": function () {
                this.options.preload = true;
                return true;
            }.bind(this),
            "*": true
        };
        this.supportsCodecs = null;

        this.audioCodecs = [
            {
                "extensions": ["aac", "m4a", "mp4"],
                "format": ["audio/aac"],
                "softCodec": [/*"/js/player/codecs/mp4.js",*/ "/js/player/codecs/aac.js"],
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
                        "Safari": function () {
                            return !("streaming" in this.options && this.options["streaming"]);
                        }.bind(this), "*": true
                    }
                },
                "info": {}
            },
            {
                "extensions": ["alac", "m4a", "mp4", "caf"],
                "format": ["audio/alac"],
                "type": "lossless",
                "softCodec": [/*"/js/player/codecs/mp4.js",*/ "/js/player/codecs/alac.js"],
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
        for (var check in this.codecSupport) {
            if (this.codecSupport.hasOwnProperty(check)) {
                if (check == '*' || navigator.userAgent.match(new RegExp(check)) > -1) {

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
        var audioTest = new Audio();
        var forceCodec = ("forceCodec" in this.options && this.options["forceCodec"]);
        for (var i = 0; i < this.audioCodecs.length; ++i) {
            var entry = this.audioCodecs[i];
            if (typeof audioTest.canPlayType === "function") {
                for (var j = 0; j < entry.format.length; ++j) {
                    if ("playback" in this.audioCodecs[i]) {
                        break;
                    }
                    var result = audioTest.canPlayType(entry.format[j]);
                    if (result in entry.supported) {
                        for (var check in entry.supported[result]) {
                            if (entry.supported[result].hasOwnProperty(check)) {
                                if (check == '*') {
                                    if (typeof entry.supported[result][check] === "function") {
                                        this.audioCodecs[i].playback = entry.supported[result][check]() ? "native" : "";
                                    } else {
                                        this.audioCodecs[i].playback = entry.supported[result][check] ? "native" : "";
                                    }
                                    break;
                                } else if (navigator.userAgent.indexOf(check) > -1) {
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

            if (!forceCodec && this.audioCodecs[i].playback == "native") {
                console.log("[UPlayer] Browser can play " + entry.format + " natively.");
            } else if ("limitCodecs" in this.options && !this.options.limitCodecs.some(r => this.audioCodecs[i]["format"].indexOf(r) >= 0)) {
                //Just do nothing
            } else if ("softCodec" in this.audioCodecs[i] && this.supportsCodecs) {

                var codecsNeeded = this.audioCodecs[i].softCodec.length;
                if (codecsNeeded == 0) {
                    this.audioCodecs[i].playback = "codec";
                    console.log("[UPlayer] Browser has no native support for " + entry.format + ", providing via software codec.");
                } else {
                    console.log("[UPlayer] Browser has no native support for " + entry.format + ", loading software codec.");
                    for (var j = 0; j < this.audioCodecs[i].softCodec.length; ++j) {
                        var codec = this.audioCodecs[i].softCodec[j];
                        var format = entry.format;
                        this.audioCodecs[i].playback = "codec";
                        $.ajax({
                            url: codec,
                            dataType: "script",
                            cache: true,
                            //crossDomain: true,
                            success: function (codec, format) {
                                console.log("[UPlayer] Loaded codec " + codec + " for " + format);
                            }.bind(this, codec, format)
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
                    }).then(function (info) {
                        if (info.supported) {
                            this.audioCodecs[i].info.concat(info);
                        }
                    }.bind(this));

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

        for (var i = 0; i < this.guessedFormats.length; ++i) {
            var playbackType = this.canPlayType(this.guessedFormats[i]);
            if (playbackType == "native") {
                this.currentFormat = i;
                break;
            }
        }

        if ("play-pause-element" in this.options) {
            this.options["play-pause-element"].removeClass("playing");
            this.options["play-pause-element"].addClass("paused");
        }
        if ("preload" in this.options && this.options["preload"]) {
            this.tryToPlay(this.currentUrl, this.guessedFormats[this.currentFormat], this.forceCodec);
        }
    }

    tryNextFormat() {
        var tryFormatNext = this.currentFormat + 1;
        if (tryFormatNext >= (this.guessedFormats.length - 1)) {
            tryFormatNext = 0;
            //this.forceCodec = !this.forceCodec;
        }

        for (var i = tryFormatNext; i < this.guessedFormats.length; ++i) {
            var playbackType = this.canPlayType(this.guessedFormats[i]);
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

        this.retryTimer = setTimeout(function () {
            this.retryTimer = null;
            this.tryToPlay(this.currentUrl, this.guessedFormats[this.currentFormat], this.forceCodec);
            this.play();
        }.bind(this), 2000);
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
            this.options["duration-minutes-element"].text(this.zeroPad(Math.floor(this.totalDuration / 60), 2));
        }
        if ("duration-seconds-element" in this.options) {
            this.options["duration-seconds-element"].text(this.zeroPad(Math.floor(this.totalDuration % 60), 2));
        }
        if ("progress-minutes-element" in this.options) {
            this.options["progress-minutes-element"].text(this.zeroPad(Math.floor((this.currentProgress * this.totalDuration) / 60), 2));
        }
        if ("progress-seconds-element" in this.options) {
            this.options["progress-seconds-element"].text(this.zeroPad(Math.floor((this.currentProgress * this.totalDuration) % 60), 2));
        }
        if (this.currentProgress >= 0.0 && this.currentProgress <= 1.0 && "progress-element" in this.options) {
            this.options["progress-element"].val(this.currentProgress);
        }
        if (this.bufferProgress >= 0.0 && this.bufferProgress <= 1.0 && "buffer-progress-element" in this.options) {
            this.options["buffer-progress-element"].val(this.bufferProgress);
        }
        if (this.currentProgress >= 0.0 && this.currentProgress <= 1.0 && "seek-element" in this.options) {
            this.options["seek-element"].val(this.currentProgress * 100);
        }

        if ("on-progress" in this.options) {
            this.options["on-progress"]();
        }
    }


    preload(url, guessedFormats, forceCodec = false) {
        var playbackType = null;
        for (var i = 0; i < guessedFormats.length; ++i) {
            playbackType = this.canPlayType(guessedFormats[i]);
            if (playbackType == "native" || playbackType == "codec") {
                break;
            }
        }

        if (forceCodec !== true && playbackType == "native") {
            this.nativePreload = true;
            this.preloadObject = new Audio();
            this.preloadObject.autoplay = false;
            this.preloadObject.preload = "auto";
            this.preloadObject.crossorigin = ("crossorigin" in this.options && this.options["crossorigin"]) ? "use-credentials" : "same-origin";
            this.preloadObject.volume = 0;
            this.preloadObject.muted = true;

            return new Promise(function (resolve, reject) {
                this.preloadObject.addEventListener("error", function (e) {
                    reject(e);
                }.bind(this));

                this.preloadObject.addEventListener("canplay", function (e) {
                    resolve(e);
                }.bind(this));

                this.preloadObject.src = url;
                this.preloadObject.load();
            }.bind(this));
        } else if (playbackType == "codec" || forceCodec == true) {
            this.nativePreload = false;
            if ("streaming" in this.options && this.options["streaming"]) {
                this.preloadObject = new AV.Player(new AV.Asset(new FetchStreamingSource(url)));
            } else {
                this.preloadObject = AV.Player.fromURL(url);
            }

            this.preloadObject.volume = 0;

            return new Promise(function (resolve, reject) {
                this.preloadObject.on("error", function (e) {
                    reject(e);
                }.bind(this));

                this.preloadObject.on("ready", function (e) {
                    resolve(e)
                }.bind(this));
                this.preloadObject.preload();
            }.bind(this));
        }

        return new Promise(function (resolve, reject) {
            reject("failed to guess codec");
        });
    }


    tryToPlay(url, currentFormat, forceCodec) {
        var playbackType = this.canPlayType(currentFormat);
        this.sentPreEndEvent = false;
        if (forceCodec !== true && playbackType == "native") {
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
                this.playerObject.addEventListener("error", function (e) {
                    if (e.target.error === null) {
                        console.log(e);
                        return;
                    }
                    if ('mediaSession' in navigator) {
                        navigator.mediaSession.playbackState = "paused";
                    }
                    if ("play-pause-element" in this.options) {
                        this.options["play-pause-element"].removeClass("playing");
                        this.options["play-pause-element"].addClass("paused");
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
                            this.retryTimer = setTimeout(function () {
                                this.retryTimer = null;
                                this.tryNextFormat();
                            }.bind(this), 1000);
                            break;
                        case e.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                            if ("on-error" in this.options) {
                                this.options["on-error"](e);
                            }
                            console.log("[UPlayer] MEDIA_ERR_SRC_NOT_SUPPORTED (" + e.target.error.code + ") when playing format " + this.guessedFormats[this.currentFormat] + ", trying different method.");
                            this.retryTimer = setTimeout(function () {
                                this.retryTimer = null;
                                this.tryNextFormat();
                            }.bind(this), 1000);
                            break;
                        default:
                            console.log(e);
                            break;
                    }
                }.bind(this));

                this.playerObject.addEventListener("play", function () {
                    if ('mediaSession' in navigator) {
                        navigator.mediaSession.playbackState = "playing";
                    }
                    if ("play-pause-element" in this.options) {
                        this.options["play-pause-element"].removeClass("paused");
                        this.options["play-pause-element"].addClass("playing");
                    }
                }.bind(this));

                this.playerObject.addEventListener("playing", function () {
                    if ('mediaSession' in navigator) {
                        navigator.mediaSession.playbackState = "playing";
                    }
                    if ("play-pause-element" in this.options) {
                        this.options["play-pause-element"].removeClass("paused");
                        this.options["play-pause-element"].addClass("playing");
                    }
                }.bind(this));

                this.playerObject.addEventListener("stalled", function () {
                    console.log("[UPlayer] Playback stalled.");
                    if ('mediaSession' in navigator) {
                        navigator.mediaSession.playbackState = "paused";
                    }
                    if ("play-pause-element" in this.options) {
                        this.options["play-pause-element"].removeClass("playing");
                        this.options["play-pause-element"].addClass("paused");
                    }
                }.bind(this));

                this.playerObject.addEventListener("ended", function () {
                    if ("on-end" in this.options) {
                        this.options["on-end"]();
                    }
                    if ('mediaSession' in navigator) {
                        navigator.mediaSession.playbackState = "paused";
                    }
                    if ("play-pause-element" in this.options) {
                        this.options["play-pause-element"].removeClass("playing");
                        this.options["play-pause-element"].addClass("paused");
                    }
                    if (this.retry) {
                        this.tryRestartPlayer("stream ended");
                    }
                }.bind(this));

                this.playerObject.addEventListener("canplay", function (e) {
                    //console.log(e);
                    this.readyToPlay = true;
                    if ("on-ready" in this.options) {
                        this.options["on-ready"]();
                    }
                    console.log("[UPlayer] Media is ready to play");
                }.bind(this));

                this.playerObject.addEventListener("loadedmetadata", function (e) {
                    //console.log(e);
                }.bind(this));

                this.playerObject.addEventListener("durationchange", function (duration) {
                    if (this.playerObject == null) {
                        return;
                    }
                    this.totalDuration = this.playerObject.duration;
                    if ("duration-minutes-element" in this.options) {
                        this.options["duration-minutes-element"].text(this.zeroPad(Math.floor(this.totalDuration / 60), 2));
                    }
                    if ("duration-seconds-element" in this.options) {
                        this.options["duration-seconds-element"].text(this.zeroPad(Math.floor(this.totalDuration % 60), 2));
                    }
                    if ("progress-minutes-element" in this.options) {
                        this.options["progress-minutes-element"].text(this.zeroPad(Math.floor((this.currentProgress * this.totalDuration) / 60), 2));
                    }
                    if ("progress-seconds-element" in this.options) {
                        this.options["progress-seconds-element"].text(this.zeroPad(Math.floor((this.currentProgress * this.totalDuration) % 60), 2));
                    }
                    if (this.currentProgress >= 0.0 && this.currentProgress <= 1.0 && "progress-element" in this.options) {
                        this.options["progress-element"].val(this.currentProgress);
                    }
                    if (this.currentProgress >= 0.0 && this.currentProgress <= 1.0 && "seek-element" in this.options) {
                        this.options["seek-element"].val(this.currentProgress * 100);
                    }

                    if ("on-progress" in this.options) {
                        this.options["on-progress"]();
                    }
                    this.checkSendPreEnd();
                }.bind(this));
                this.playerObject.addEventListener("progress", function () {
                    if (this.playerObject == null) {
                        return;
                    }
                    if (this.totalDuration > 0.0) {
                        this.bufferProgress = ((this.playerObject.buffered.length > 0 ? this.playerObject.buffered.end(0) : 0) / this.totalDuration);
                    }
                    if (this.bufferProgress >= 0.0 && this.bufferProgress <= 1.0 && "buffer-progress-element" in this.options) {
                        this.options["buffer-progress-element"].val(this.bufferProgress);
                    }
                }.bind(this));
                this.playerObject.addEventListener("timeupdate", function () {
                    if (this.playerObject == null) {
                        return;
                    }
                    if (this.totalDuration > 0.0) {
                        this.currentProgress = (this.playerObject.currentTime / this.totalDuration);
                    }
                    if ("progress-minutes-element" in this.options) {
                        this.options["progress-minutes-element"].text(this.zeroPad(Math.floor((this.currentProgress * this.totalDuration) / 60), 2));
                    }
                    if ("progress-seconds-element" in this.options) {
                        this.options["progress-seconds-element"].text(this.zeroPad(Math.floor((this.currentProgress * this.totalDuration) % 60), 2));
                    }
                    if (this.currentProgress >= 0.0 && this.currentProgress <= 1.0 && "progress-element" in this.options) {
                        this.options["progress-element"].val(this.currentProgress);
                    }
                    if (this.currentProgress >= 0.0 && this.currentProgress <= 1.0 && "seek-element" in this.options) {
                        this.options["seek-element"].val(this.currentProgress * 100);
                    }

                    if ("on-progress" in this.options) {
                        this.options["on-progress"]();
                    }
                    this.checkSendPreEnd();
                }.bind(this));
            }

            this.playerObject.src = this.currentUrl;

            if ("preload" in this.options && this.options["preload"]) {
                this.playerObject.load();
            }
        } else if (playbackType == "codec" || forceCodec == true) {
            this.nativePlayback = false;
            if ("streaming" in this.options && this.options["streaming"]) {
                this.playerObject = new AV.Player(new AV.Asset(new FetchStreamingSource(this.currentUrl)));
            } else {
                this.playerObject = AV.Player.fromURL(this.currentUrl);
            }

            this.playerObject.volume = this.volume * 100;

            this.playerObject.on("error", function (e) {
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = "paused";
                }
                if ("play-pause-element" in this.options) {
                    this.options["play-pause-element"].removeClass("playing");
                    this.options["play-pause-element"].addClass("paused");
                }
                if ("on-error" in this.options) {
                    this.options["on-error"](e);
                }
                if (this.retry) {
                    this.tryRestartPlayer(e);
                } else {
                    console.log("[UPlayer] Error: " + e);
                }
            }.bind(this));
            this.playerObject.on("end", function () {
                if ("on-end" in this.options) {
                    this.options["on-end"]();
                }
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = "paused";
                }
                if ("play-pause-element" in this.options) {
                    this.options["play-pause-element"].removeClass("playing");
                    this.options["play-pause-element"].addClass("paused");
                }
                if (this.retry) {
                    this.tryRestartPlayer("stream ended");
                }
            }.bind(this));

            this.playerObject.on("ready", function () {
                this.readyToPlay = true;
                if ("on-ready" in this.options) {
                    this.options["on-ready"]();
                }
                console.log("[UPlayer] Media is ready to play");
            }.bind(this));

            this.playerObject.on("format", function (format) {
                console.log(format);
            }.bind(this));
            this.playerObject.on("metadata", function (metadata) {
                console.log(metadata);
            }.bind(this));


            this.playerObject.on("duration", function (duration) {
                this.totalDuration = duration / 1000;
                if ("duration-minutes-element" in this.options) {
                    this.options["duration-minutes-element"].text(this.zeroPad(Math.floor(this.totalDuration / 60), 2));
                }
                if ("duration-seconds-element" in this.options) {
                    this.options["duration-seconds-element"].text(this.zeroPad(Math.floor(this.totalDuration % 60), 2));
                }
                if ("progress-minutes-element" in this.options) {
                    this.options["progress-minutes-element"].text(this.zeroPad(Math.floor((this.currentProgress * this.totalDuration) / 60), 2));
                }
                if ("progress-seconds-element" in this.options) {
                    this.options["progress-seconds-element"].text(this.zeroPad(Math.floor((this.currentProgress * this.totalDuration) % 60), 2));
                }
                if (this.currentProgress >= 0.0 && this.currentProgress <= 1.0 && "progress-element" in this.options) {
                    this.options["progress-element"].val(this.currentProgress);
                }
                if (this.currentProgress >= 0.0 && this.currentProgress <= 1.0 && "seek-element" in this.options) {
                    this.options["seek-element"].val(this.currentProgress * 100);
                }
                if ("on-progress" in this.options) {
                    this.options["on-progress"]();
                }
                this.checkSendPreEnd();
            }.bind(this));
            this.playerObject.on("buffer", function (percent) {
                this.bufferProgress = percent / 100;
                if (this.bufferProgress >= 0.0 && this.bufferProgress <= 1.0 && "buffer-progress-element" in this.options) {
                    this.options["buffer-progress-element"].val(this.bufferProgress);
                }
            }.bind(this));
            this.playerObject.on("progress", function (time) {
                if (this.totalDuration > 0.0) {
                    this.currentProgress = (time / 1000) / this.totalDuration;
                }
                if ("progress-minutes-element" in this.options) {
                    this.options["progress-minutes-element"].text(this.zeroPad(Math.floor((this.currentProgress * this.totalDuration) / 60), 2));
                }
                if ("progress-seconds-element" in this.options) {
                    this.options["progress-seconds-element"].text(this.zeroPad(Math.floor((this.currentProgress * this.totalDuration) % 60), 2));
                }
                if (this.currentProgress >= 0.0 && this.currentProgress <= 1.0 && "progress-element" in this.options) {
                    this.options["progress-element"].val(this.currentProgress);
                }
                if (this.currentProgress >= 0.0 && this.currentProgress <= 1.0 && "seek-element" in this.options) {
                    this.options["seek-element"].val(this.currentProgress * 100);
                }
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = "playing";
                }
                if ("play-pause-element" in this.options) {
                    this.options["play-pause-element"].removeClass("paused");
                    this.options["play-pause-element"].addClass("playing");
                }

                if ("on-progress" in this.options) {
                    this.options["on-progress"]();
                }
                this.checkSendPreEnd();
            }.bind(this));

            if ("preload" in this.options && this.options["preload"]) {
                this.playerObject.preload();
            }
        }

        this.oldPlayerObject = null;
        this.oldNativePlayback = null;
    }

    checkSendPreEnd() {
        var left = (this.totalDuration - this.currentProgress * this.totalDuration);
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
                var promise = this.playerObject.play();
                if (promise !== undefined) {
                    promise.catch(function (error) {
                        console.log(error);
                        // Auto-play was prevented
                        // Show a UI element to let the user manually start playback
                        if ("on-error" in this.options) {
                            this.options["on-error"](error);
                        }
                    }.bind(this)).then(function () {
                        if ('mediaSession' in navigator) {
                            navigator.mediaSession.playbackState = "playing";
                            if ("streaming" in this.options && this.options.streaming) {
                                this.resyncMediaToLoadedTrack();
                            }
                        }
                        // Auto-play started

                    }.bind(this));
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
            this.options["play-pause-element"].removeClass("paused");
            this.options["play-pause-element"].addClass("playing");
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
            this.options["mute-element"].removeClass("not-muted");
            this.options["mute-element"].addClass("muted");
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
            this.options["mute-element"].removeClass("muted");
            this.options["mute-element"].addClass("not-muted");
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
                this.options["play-pause-element"].removeClass("playing");
                this.options["play-pause-element"].addClass("paused");
            }
        }
    }


    canPlayExtension(toTest) {
        for (var i = 0; i < this.audioCodecs.length; ++i) {
            if (this.audioCodecs[i].extensions.includes(toTest)) {
                return this.audioCodecs[i].playback;
            }
        }

        return "";
    }

    getFormatsForExtension(ext) {
        var formats = [];
        for (var i = 0; i < this.audioCodecs.length; ++i) {
            if (this.audioCodecs[i].extensions.includes(ext)) {
                formats.push(this.audioCodecs[i].format[0]);
            }
        }

        return formats;
    }

    //MediaDecodingConfiguration
    decodingInfo(conf) {
        if ('type' in conf && (conf.type === 'file' || conf.type === 'media-source') && 'audio' in conf && 'contentType' in conf.audio) {
            for (var i = 0; i < this.audioCodecs.length; ++i) {
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
        for (var i = 0; i < this.audioCodecs.length; ++i) {
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
        }).then(function (response) {
            this.reader = response.body.getReader();
            this.reader.read().then(this.receiveChunk.bind(this)).catch(function (err) {
                this.emit("error", err);
            }.bind(this));
        }.bind(this)).catch(function (err) {
            this.emit("error", err);
        }.bind(this));
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
        this.reader.read().then(this.receiveChunk.bind(this)).catch(function (err) {
            this.emit("error", err);
        }.bind(this));
    }

    start() {
        if (this.request == null) {
            this.init();
        }
    }

    pause() {
        if (this.request != null) {
            if (this.reader != null) {
                this.reader.cancel().catch(function (err) {

                }.bind(this));
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
