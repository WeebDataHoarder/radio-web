var audioStreams = [


    /* --- AAC --- */
    {
        "id": "stream256.aac",
        "name": "AAC@256kbit/s",
        "url": "/stream/stream256.aac",
        "bitrate": 256,
        "format": "audio/aac",
        "quality": "high"
    },
    {
        "id": "stream128.aac",
        "name": "AAC@128kbit/s",
        "url": "/stream/stream128.aac",
        "bitrate": 128,
        "format": "audio/aac",
        "quality": "medium"
    },
    {
        "id": "stream64.aac",
        "name": "AAC@64kbit/s",
        "url": "/stream/stream64.aac",
        "bitrate": 64,
        "format": "audio/aac",
        "quality": "low"
    },

    /* --- OGG/Opus --- */
    {
        "id": "stream256.ogg",
        "name": "Opus@256kbit/s",
        "url": "/stream/stream256.ogg",
        "bitrate": 256,
        "format": "audio/ogg;codecs=opus",
        "quality": "high"
    },
    {
        "id": "stream128.ogg",
        "name": "Opus@128kbit/s",
        "url": "/stream/stream128.ogg",
        "bitrate": 128,
        "format": "audio/ogg;codecs=opus",
        "quality": "medium"
    },
    {
        "id": "stream64.ogg",
        "name": "Opus@64kbit/s",
        "url": "/stream/stream64.ogg",
        "bitrate": 64,
        "format": "audio/ogg;codecs=opus",
        "quality": "low"
    },

    /* --- MP3 --- */
    {
        "id": "stream192.mp3",
        "name": "MP3@192kbit/s",
        "url": "/stream/stream192.mp3",
        "bitrate": 192,
        "format": "audio/mpeg;codecs=mp3",
        "quality": "medium"
    },

    /* --- FLAC --- */
    {
        "id": "stream.flac",
        "name": "FLAC@16-bit",
        "url": "/stream/stream.flac",
        "bitrate": 0,
        "format": "audio/flac",
        "quality": "lossless"
    }
];

var compatibleFormats = {};

var compatibleAudioStreams = [];

function findCompatibleAudioStreams() {
    for (var i = 0; i < audioStreams.length; ++i) {
        var entry = audioStreams[i];
        var info = uplayer.decodingInfo({
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

    if (compatibleAudioStreams.length == 0) {
        //TODO: wat
    }
}

function selectAudioStream(wantedQualities) {
    var selectedStream = -1;

    for (var j = 0; j < wantedQualities.length; ++j) {
        var wantedQuality = wantedQualities[j];
        for (var i = 0; i < compatibleAudioStreams.length; ++i) {
            var entry = audioStreams[i];
            if (entry.quality == wantedQuality) {
                selectedStream = i;
                break;
            }
        }

        if (selectedStream != -1) {
            break;
        }
    }

    return selectedStream == -1 ? null : compatibleAudioStreams[selectedStream];
}
