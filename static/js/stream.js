const audioStreams = [
    /* --- AAC --- */
    {
        "id": "stream128.aac",
        "name": "AAC (VBR ~148kbit/s)",
        "url": "/stream/stream128.aac",
        "bitrate": 128,
        "format": "audio/aac",
        "quality": "medium"
    },

    /* --- OGG/Opus --- */
    {
        "id": "stream256.ogg",
        "name": "Opus (256kbit/s)",
        "url": "/stream/stream256.ogg",
        "bitrate": 256,
        "format": "audio/ogg;codecs=opus",
        "quality": "high"
    },
    {
        "id": "stream128.ogg",
        "name": "Opus (128kbit/s)",
        "url": "/stream/stream128.ogg",
        "bitrate": 128,
        "format": "audio/ogg;codecs=opus",
        "quality": "medium"
    },
    {
        "id": "stream64.ogg",
        "name": "Opus (64kbit/s)",
        "url": "/stream/stream64.ogg",
        "bitrate": 64,
        "format": "audio/ogg;codecs=opus",
        "quality": "low"
    },

    /* --- MP3 --- */
    {
        "id": "stream192.mp3",
        "name": "MP3 (VBR ~192kbit/s)",
        "url": "/stream/stream192.mp3",
        "bitrate": 192,
        "format": "audio/mpeg;codecs=mp3",
        "quality": "medium"
    },

    /* --- FLAC --- */
    {
        "id": "stream.flac",
        "name": "FLAC (16-bit)",
        "url": "/stream/stream.flac",
        "bitrate": 0,
        "format": "audio/flac",
        "quality": "lossless"
    }
];

const compatibleFormats = {};

const compatibleAudioStreams = [];

function findCompatibleAudioStreams() {
    for(const entry of audioStreams){
        const info = uplayer.decodingInfo({
            type: "file",
            audio: {
                contentType: entry.format,
                channels: 2,
                bitrate: entry.bitrate * 1024
            }
        });
        if (info.supported) {
            entry.info = info;
            compatibleAudioStreams.push(entry);
        }
    }

    if (compatibleAudioStreams.length === 0) {
        //TODO: wat
    }
}

function selectAudioStream(wantedQualities) {
    let selectedStream = null;

    for(const wantedQuality of wantedQualities){
        for(const entry of compatibleAudioStreams) {
            if (entry.quality === wantedQuality) {
                selectedStream = entry;
                break;
            }
        }
        if (selectedStream !== null) {
            break;
        }
    }

    return selectedStream;
}
