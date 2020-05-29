var basePageUrl = new URL(document.location.origin);
if (basePageUrl.searchParams.get("apiurl") !== null) {
    if (basePageUrl.searchParams.get("apiurl") === "") {
        window.localStorage.removeItem("radio-api-url");
    } else {
        window.localStorage.setItem("radio-api-url", String(basePageUrl.searchParams.get("apiurl")).trimEnd("/"));
    }
}

var baseApiUrl = window.localStorage.getItem("radio-api-url") != null ? window.localStorage.getItem("radio-api-url") : location.protocol + '//' + document.domain + ':' + location.port;
var apiKey = null;

$(".volume-slider").on("change", function () {
    window.localStorage.setItem("radio-volume", $(this).val());
});

var uplayer = new UPlayer({
    "limitCodecs": ["audio/flac", "audio/ogg;codecs=opus", "audio/mpeg;codecs=mp3", "audio/aac"],
    "volume": window.localStorage.getItem("radio-volume") !== null ? window.localStorage.getItem("radio-volume") / 100 : 1.0,
    "preload": true,
    "streaming": true,
    "muted": false,
    "retry": true,
    "play-pause-element": $(".play-pause"),
    //"progress-minutes-element": $(".radio-current-minutes"),
    //"progress-seconds-element": $(".radio-current-seconds"),
    //"duration-minutes-element": $(".radio-duration-minutes"),
    //"duration-seconds-element": $(".radio-duration-seconds"),
    //"progress-element": $(".radio-song-played-progress"),
    //"buffer-progress-element": $(".radio-song-played-progress"),
    "mute-element": $(".mute"),
    "volume-element": $(".volume-slider"),
    "on-ready": function () {
        $(".play-pause").removeClass("hidden");
    }
});

findCompatibleAudioStreams();

var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

var audioStream = null;
if (connection && (connection.effectiveType === "cellular" || connection.effectiveType === "bluetooth" || connection.saveData)) {
    //better data usage
    audioStream = selectAudioStream(["medium"]);
} else {
    audioStream = selectAudioStream(["high", "medium"]);
}


if (audioStream === null) {
    audioStream = compatibleAudioStreams[0];
}

if (window.localStorage.getItem("radio-stream-id") !== null) {
    for (var i = 0; i < compatibleAudioStreams.length; ++i) {
        if (compatibleAudioStreams[i].id == window.localStorage.getItem("radio-stream-id")) {
            audioStream = compatibleAudioStreams[i];
            break;
        }
    }
}

for (var i = 0; i < compatibleAudioStreams.length; ++i) {
    var stream = compatibleAudioStreams[i];
    var element = jQuery("#radio-quality-group-" + stream.quality);
    if (element.length == 0) {
        element = jQuery("#radio-quality");
    }
    element.append('<option value="' + stream.id + '" ' + (stream.id == audioStream.id ? " selected" : "") + '>' + (stream.info.playbackType == "codec" ? stream.name + " (via codec" + (stream.info.powerEfficient ? "" : ", power-hungry") + ")" : stream.name + (stream.info.powerEfficient ? "" : ", power-hungry")) + '</option>');
}

for (var i = 0; i < audioStreams.length; ++i) {
    var stream = audioStreams[i];
    jQuery("#streams-" + stream.quality).append('<a href="' + (new URL(stream.url, baseApiUrl)).href + '" id="stream-' + stream.id + '" class="stream-link button">' + stream.name + '</a>');
}

console.log("Playing " + audioStream.quality + " - " + audioStream.name);
uplayer.init((new URL(audioStream.url, baseApiUrl)).href, [audioStream.format]);

if (docCookies.getItem("radio-apikey") !== null) {
    apiKeyIdentify(docCookies.getItem("radio-apikey"));
} else {
    initWebSocket();
}

var deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;

    if (window.localStorage.getItem("radio-skip-install") === "yes") {
        return;
    }

    $("#install-webapp").removeClass("hidden");
});

$("#install-webapp").on("click", function () {
    if (deferredPrompt === null) {
        return;
    }
    $("#install-webapp").addClass("hidden");
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function (choiceResult) {
        if (choiceResult.outcome === 'accepted') {
            window.localStorage.setItem("radio-skip-install", "no");
        } else {
            window.localStorage.setItem("radio-skip-install", "yes");
        }
        deferredPrompt = null;
    });
});
