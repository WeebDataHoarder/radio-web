"use strict";

async function require(path, global = null) {
    const _module = window.module;
    window.module = {};
    window.module = {};
    await import(path);
    let exports;
    if(global !== null){
        exports = window[global];
    }else{
        exports = module.exports;
    }
    window.module = _module; // restore global
    return exports;
}

const SubtitlesOctopus = require("./subtitles/subtitles-octopus.js");

class Subtitles {

    /**
     * @param {HTMLCanvasElement} canvasElement
     * @param options
     */
    constructor(canvasElement, options = {}) {
        /**
         * @type {HTMLCanvasElement}
         */
        this.canvas = canvasElement;
        /**
         * @type {SubtitlesOctopus}
         */
        this.octopus = null;
        this.octopusReady = false;

        this.timer = null;

        this.options = options;
        for(const [key, value] of Object.entries({
            displaySettings: {
                showOriginal: false,
                fadeTransition: true,
                karaoke: {
                    animate: true
                }
            },
            availableFonts: {
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
            },
            targetFps: 30,
            resizeVariation: 0.1,
            libassMemoryLimit: 40,
            libassGlyphLimit: 40,
            currentTimeCallback: null
        })){
            if(!(key in this.options)){
                this.options[key] = value;
            }
        }
        this.currentTime = 0.0;

        document.addEventListener("fullscreenchange", this.resizeToMatchCanvas.bind(this));
        document.addEventListener("mozfullscreenchange", this.resizeToMatchCanvas.bind(this));
        document.addEventListener("webkitfullscreenchange", this.resizeToMatchCanvas.bind(this));
        document.addEventListener("msfullscreenchange", this.resizeToMatchCanvas.bind(this));
        window.addEventListener("resize", this.resizeToMatchCanvas.bind(this));
    }

    resizeToMatchCanvas(){
        if(this.octopus === null){
            return;
        }
        const ar = this.canvas.getAttribute("aspect-ratio");
        const canvasStyles = window.getComputedStyle(this.canvas);
        const width = canvasStyles.width.replace(/px$/, "");
        let height = canvasStyles.height.replace(/px$/, "");
        if(ar){
            const newHeight = String(Math.ceil(width / parseFloat(ar)));
            if(newHeight !== height){
                this.canvas.style.top = "-" + newHeight + "px";
                this.canvas.style.height = newHeight + "px";
                height = newHeight;
            }
        }

        const pixelRatio = "devicePixelRatio" in window ? window.devicePixelRatio : 1;
        this.octopus.resize(width * pixelRatio, height * pixelRatio, 0, 0);
    }

    /**
     * Sets the current time in seconds
     * @param time
     */
    setCurrentTime(time){
        this.currentTime = time;

        if(this.octopus !== null && this.octopusReady){
            this.octopus.setCurrentTime(this.currentTime);
        }
    }

    async loadSubtitles(data, overrideOptions = {}){
        const options = Object.assign(Object.assign({}, this.options), overrideOptions);
        this.stopSubtitles();

        if(data.type === "ass"){
            const displayInformation = await this._processASSSubtitles(data.content);
            this.canvas.setAttribute("aspect-ratio", displayInformation.resolution.aspectRatio);
            this.canvas.style["background-color"] = "rgba("+displayInformation.background.red+", "+displayInformation.background.green+", "+displayInformation.background.blue+", "+displayInformation.background.alpha+")";

            options.canvas = this.canvas;
            options.dropAllAnimations = (!options.displaySettings.karaoke.animate && !options.displaySettings.fadeTransition);
            options.workerUrl = "/js/modules/subtitles/subtitles-octopus-worker.js";
            options.legacyWorkerUrl = "/js/modules/subtitles/subtitles-octopus-worker-legacy.js";
            options.renderMode = typeof createImageBitmap !== 'undefined' ? "fast" : "normal";
            //renderMode: "blend",
            options.availableFonts = Object.assign(Object.assign({}, options.availableFonts), displayInformation.embeddedFonts);
            options.subContent = data.content;
            //renderAhead: 30,
            options.onReady = () => {
                this.octopusReady = true;
                this.octopus.setCurrentTime(this.currentTime);
                this.resizeToMatchCanvas();
            };

            this.octopus = new (await SubtitlesOctopus)(options);
            this.octopus.setCurrentTime(this.currentTime);
            if(options.currentTimeCallback !== null){
                if(this.timer !== null){
                    clearInterval(this.timer);
                    this.timer = null;
                }
                const callback = options.currentTimeCallback;
                this.timer = setInterval(() => {
                    this.setCurrentTime(callback());
                }, Math.floor(1 / options.targetFps * 1000));
            }
            this.resizeToMatchCanvas();
        }else if (data.type === "entries"){
            data.content = await this._createASSFromEntries(data.entries, options.displaySettings);
            data.type = "ass";
            await this.loadSubtitles(data, options);
        }else if (data.type === "lrc"){
            const entries = await this._convertLRCtoEntries(data.content);
            data.type = "entries";
            data.entries = entries;
            await this.loadSubtitles(data, options);
        }
    }

    stopSubtitles(){
        if(this.timer !== null){
            clearInterval(this.timer);
            this.timer = null;
        }
        if(this.octopus !== null){
            this.octopus.dispose();
            this.octopus = null;
        }
        this.octopusReady = false;
    }

    hideSubtitles(){
        this.canvas.style["height"] = "0px";
        this.canvas.style["top"] = "-0px";
    }

    async _processASSSubtitles(file){
            const promises = [];


            const displayInformation = {
                resolution: {
                    aspectRatio: 10.6666667//1.777778
                },
                background: {red: 0, green: 0, blue: 0, alpha: 0.4},
                embeddedFonts: {}
            };

            promises.push(new Promise((resolve, reject) => {
                const promises = [];
                const regex = /^fontname((v2:[ \t]*(?<fontName2>[^_]+)_(?<fontProperties2>[^,]*)\.(?<fontExtension2>[a-z0-9]{3,5}),[ \t]*(?<fontContent2>.+)$)|(:[ \t]*(?<fontName>[^_]+)_(?<fontProperties>[^$]*)\.(?<fontExtension>[a-z0-9]{3,5})(?<fontContent>(?:\r?\n[\x21-\x60]+)+)))/mg;
                let result;
                while((result = regex.exec(file)) !== null){
                    if("fontName2" in result.groups && result.groups.fontName2 !== undefined){
                        displayInformation.embeddedFonts[result.groups.fontName2.toLowerCase()] = result.groups.fontContent2;
                    }else{
                        const currentResult = result;
                        promises.push(new Promise((resolve, reject) => {
                            const blob = new Blob([this._decodeASSFontEncoding(currentResult.groups.fontContent)], {type: "application/font-" + currentResult.groups.fontExtension.toLowerCase()});
                            const reader = new FileReader();
                            reader.readAsDataURL(blob);
                            reader.addEventListener("load", function () {
                                displayInformation.embeddedFonts[currentResult.groups.fontName.toLowerCase()] = reader.result;
                                resolve();
                            }, false);
                        }));
                    }
                }
                Promise.all(promises).then(resolve).catch(reject);
            }));
            promises.push(new Promise((resolve, reject) => {
                let result;
                result = file.match(/^PlayResX:[ \t]*([0-9]+)$/m);
                if(result !== null){
                    displayInformation.resolution.x = parseInt(result[1]);
                }
                resolve();
            }));
            promises.push(new Promise((resolve, reject) => {
                let result;
                result = file.match(/^PlayResY:[ \t]*([0-9]+)$/m);
                if(result !== null){
                    displayInformation.resolution.y = parseInt(result[1]);
                }
                resolve();
            }));
            promises.push(new Promise((resolve, reject) => {
                let result;
                result = file.match(/^CanvasBackground:[ \t]*&H(?<alpha>[0-9A-F]{2})(?<blue>[0-9A-F]{2})(?<green>[0-9A-F]{2})(?<red>[0-9A-F]{2})$/m);
                if(result !== null){
                    displayInformation.background.alpha = parseInt(result.groups.alpha, 16) / 255;
                    displayInformation.background.blue = parseInt(result.groups.blue, 16) / 255;
                    displayInformation.background.green = parseInt(result.groups.green, 16) / 255;
                    displayInformation.background.red = parseInt(result.groups.red, 16) / 255;
                }
                resolve();
            }));

            await Promise.all(promises);
            if(displayInformation.resolution.x && displayInformation.resolution.y){
                displayInformation.resolution.aspectRatio = displayInformation.resolution.x / displayInformation.resolution.y;
            }
            return displayInformation;
    }

    _decodeASSFontEncoding(input){
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




    async _convertLRCtoEntries(data){
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

        const Kuroshiro = await importKuroshiro();
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
        });
        await Promise.all(promises);

        return lyricEntries;
    }


    _createASSFromEntries(lyricEntries, displaySettings){
        return new Promise(((resolve, reject) => {
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
                'Video File: ?dummy:30:40000:512:52:47:163:254:\n' +
                'Video AR Value: 5.000000\n' +
                '\n' +
                '[V4+ Styles]\n' +
                'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n' +
                'Style: Current,Open Sans,24,&H00FFFFFF,&H00B1B1B1,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,1,0,5,5,5,0,1\n' +
                '\n' +
                '[Events]\n' +
                'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';

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
                return ((displaySettings.showOriginal && ob.originalText) ? ob.originalText : ob.text).replace(/[ ]+/g, ' ');
            };

            subtitleFile += 'Dialogue: 0,0:00:00.00,0:00:05.00,Current,,0,0,0,,{\\pos(1,1)\\alpha&FF}WARMUP\n'; //Do this to "pre-render"
            subtitleFile += 'Dialogue: 0,0:00:05.00,0:00:15.00,Current,,0,0,0,,{\\pos(1,1)\\alpha&FF}WARMUP\n'; //Do this to "pre-render"

            lyricEntries.forEach((line) => {
                //TODO: secondary line

                let entryLine = 'Dialogue: 1,' + timeToStamp(line.start) + ', ' + timeToStamp(line.end !== undefined ? line.end : line.start + 5) + ',Current,,0,0,0,,';
                const lineDuration = Math.max(1, Math.floor(((line.end !== undefined ? line.end : line.start + 5) - line.start) * 100));
                if(line.entries && line.entries.length > 0){
                    entryLine += ((displaySettings.fadeTransition && lineDuration > 50) ? '{\\fade(50,250)}' : '');
                    for(let k = 0; k < line.entries.length; ++k){
                        const entry = line.entries[k];
                        const entryDuration = Math.max(1, Math.floor(((entry.end !== undefined ? Math.min(line.end !== undefined ? line.end : entry.end, entry.end) : (line.end !== undefined ? line.end : line.start + 5)) - entry.start) * 100));
                        entryLine += (displaySettings.karaoke ? (displaySettings.karaoke.animate ? '{\\kf'+entryDuration+'}' : '{\\k'+entryDuration+'}') : '') + pickText(entry);
                    }
                }else{
                    const txt = pickText(line);
                    if(txt.trim() === ""){
                        return;
                    }
                    entryLine += '{'+(lineDuration > 50 ? '\\fade(50,250)' : '') + (displaySettings.karaoke ? (displaySettings.karaoke.animate ? '\\kf' + lineDuration : '\\k' + lineDuration) : '') + '}' + txt;
                }

                subtitleFile += entryLine + '\n';
            });

            resolve(subtitleFile);
        }));
    }
}

let _kuroshiroImportPromise = null;
let _kuroshiroInitPromise = null;

function importKuroshiro(){
    return _kuroshiroImportPromise !== null ? _kuroshiroImportPromise : _kuroshiroImportPromise = require("./kuroshiro.min.js", "Kuroshiro");
}

async function convertJapaneseToRomaji(text){
    if(_kuroshiroInitPromise === null){
        _kuroshiroInitPromise = new Promise(async (resolve, reject) => {
            const kuroshiro = new (await importKuroshiro())();
            await kuroshiro.init(new (await require("./kuroshiro-analyzer-kuromoji.min.js", "KuromojiAnalyzer"))({
                dictPath: "/dict/"
            }));
            resolve(kuroshiro);
        });
    }

    try{
        return await (await _kuroshiroInitPromise).convert(text, {
            to: "romaji",
            mode: "spaced",
            romajiSystem: "hepburn"
        });
    } catch (e) {
        console.log(e);
        return text;
    }
}

export default Subtitles;