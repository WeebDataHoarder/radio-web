<?php

use Limelight\Limelight;

require_once("common.php");

$dbconn = connectToMusicDatabase();
if ($dbconn === null) {
    exit();
}


$hashSql = <<<SQL
SELECT
songs.id AS id,
songs.hash AS hash,
songs.title AS title,
(SELECT artists.name FROM artists WHERE songs.artist = artists.id LIMIT 1) AS artist,
(SELECT albums.name FROM albums WHERE songs.album = albums.id LIMIT 1) AS album,  
songs.path AS path,
songs.duration AS duration,
songs.cover AS cover,
songs.lyrics AS lyrics,
songs.status AS status,
array_to_json(ARRAY(SELECT tags.name FROM tags JOIN taggings ON (taggings.tag = tags.id) WHERE taggings.song = songs.id)) AS tags,
array_to_json(ARRAY(SELECT users.name FROM users JOIN favorites ON (favorites.user_id = users.id) WHERE favorites.song = songs.id)) AS favored_by
FROM songs
WHERE songs.hash LIKE $1
ORDER BY album ASC, path ASC
;
SQL;

$actualPath = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);

if (preg_match("#^/service/encode/(?P<hash>[a-fA-F0-9]{8,32})(|/(?P<codec>(m4a|aac|mp3|opus|flac|mkv)))$#", $actualPath, $matches) > 0) {
    $hash = $matches["hash"];
    $codec = strtolower($matches["codec"] ?? "");

    $result = pg_query_params($dbconn, $hashSql, [$hash . "%"]);
    while ($data = pg_fetch_row($result, null, PGSQL_ASSOC)) {
        foreach ($data as $k => &$v) {
            if ($k === "tags" or $k === "favored_by" or $k === "lyrics") {
                $v = json_decode($v, true);
            }
        }

        if(isset($_GET["realtime"]) and $_GET["realtime"] !== "false" and $_GET["realtime"] !== "0"){
            $cmd = "ffmpeg -hide_banner -loglevel panic -strict -2 -re -i " . escapeshellarg($data["path"]);
        }else{
            $cmd = "ffmpeg -hide_banner -loglevel panic -strict -2 -i " . escapeshellarg($data["path"]);
        }

        $tempFiles = [];

        if($codec === "mkv"){
            $cmd .= " ";
            $params = "-map_metadata -1 -map 0:a ";

            if($data["cover"] !== null){
                $cmd .= " -i " . escapeshellarg(DEFAULT_API_URL . "/cover/" . $data["cover"] ."/original") . " ";
            }

            $subs = null;
            if(isset($data["lyrics"]["ass"])){
                $subs = [tempnam("/tmp", "encode_"), $data["lyrics"]["ass"]];
            }else if(isset($data["lyrics"]["timed"])){
                require_once("subs.php");
                $subs = [tempnam("/tmp", "encode_"), createASSFromEntries(convertLRCtoEntries($data["lyrics"]["timed"]), $data["duration"])];
            }

            if($subs !== null){
                file_put_contents($subs[0], $subs[1]);
                $playResX = 512;
                $playResY = 52;
                if(preg_match('/^PlayResX:[ \t]*([0-9]+)$/m', $subs[1], $m) > 0){
                    $playResX = (int) $m[1];
                }
                if(preg_match('/^PlayResY:[ \t]*([0-9]+)$/m', $subs[1], $m) > 0){
                    $playResY = (int) $m[1];
                }

                //$cmd .= " -i " . escapeshellarg(DEFAULT_API_URL . "lyrics/" . $data["cover"] ."/ass") . " ";
                $cmd .= " -f ass -i " . escapeshellarg($subs[0]) . " ";

                $multiplier = (int) max(1, ceil( ($playResX / $playResY) > 2 ? 2048 / $playResX : 1024 / $playResY));

                $playResX *= $multiplier;
                $playResY *= $multiplier;
                $playResY = ($playResY % 2) === 0 ? $playResY : $playResY + 1; // & ~1;
                $playResX = ($playResX % 2) === 0 ? $playResX : $playResX + 1; // & ~1;

                $cmd .= " -f lavfi -i 'color=size={$playResX}x{$playResY}:rate=30:duration=".($data["duration"] + 1).":color=black' ";
                if($data["cover"] !== null){
                    $params .=  "-map 2:s -filter_complex '[1:v]scale=w=-1:h={$playResY}[cover];[3:v][cover]overlay=eof_action=repeat[out]' -map '[out]' ";
                }else{
                    $params .=  "-map 1:s -map 2:v ";
                }

                if(isRequestVideoPlayer()){
                    $params .= "-c:s ass -disposition:s:0 forced -pix_fmt yuv444p10le -c:v libx264 -preset:v veryfast -profile:v high444 -tune:v stillimage -crf 28 -x264opts \"intra-refresh=1:keyint=3600:min-keyint=900:no-scenecut\" ";
                }else{
                    $params .= "-c:s ass -disposition:s:0 forced -pix_fmt yuv420p -c:v libx264 -preset:v veryfast -profile:v high -tune:v stillimage -crf 28 -x264opts \"intra-refresh=1:keyint=3600:min-keyint=900:no-scenecut\" ";
                }
            }else if($data["cover"] !== null) {

                $cmd .= " -f lavfi -i 'color=size=2x2:rate=30:duration=".($data["duration"] + 1).":color=black' ";

                if(isRequestVideoPlayer()){
                    $params .= "-filter_complex '[1:v]scale=trunc(iw/2)*2:trunc(ih/2)*2[ref];[2:v][ref]scale2ref[black][cover];[black][cover]overlay=eof_action=repeat[out]' -map '[out]' -c:v libx264 -preset:v veryfast -profile:v high444 -pix_fmt yuv444p10le -tune:v stillimage -crf 28 -x264opts \"intra-refresh=1:keyint=3600:min-keyint=900:no-scenecut\" ";
                }else{
                    $params .= "-filter_complex '[1:v]scale=trunc(iw/2)*2:trunc(ih/2)*2[ref];[2:v][ref]scale2ref[black][cover];[black][cover]overlay=eof_action=repeat[out]' -map '[out]' -c:v libx264 -preset:v veryfast -profile:v high yuv420p -tune:v stillimage -crf 28 -x264opts \"intra-refresh=1:keyint=3600:min-keyint=900:no-scenecut\" ";
                }
            }
            $cmd .= $params;
        }else{
            $cmd .= " -map_metadata -1 -filter_complex '[0:a]volume=volume=1.0:replaygain=track[out]' -map '[out]' -ac 2 ";
        }

        //header("Transfer-encoding: chunked");
        header("Accept-Ranges: none");
        switch ($codec){
            case "m4a":
                $cmd .= " -ar 44100 -c:a aac -b:a 256k -f mp4 -moov_size 8192 -movflags frag_keyframe+empty_moov+separate_moof+omit_tfhd_offset -frag_duration 1000 -min_frag_duration 100";
                header("Content-Type: audio/m4a;codecs=aac");
                break;
            case "aac":
                $cmd .= " -ar 44100 -c:a aac -b:a 256k -f adts";
                header("Content-Type: audio/aac");
                break;
            default:
            case "mp3":
                // MP3 can't handle 192 kHz, so encode at 44.1
                $cmd .= " -ar 44100 -c:a libmp3lame -q:a 0 -f mp3 -write_xing 0 -id3v2_version 0";
                header("Content-Type: audio/mpeg;codecs=mp3");
                break;
            case "opus":
                // OPUS only supports 48kHz sample rates
                $cmd .= " -ar 48000 -c:a libopus -b:a 192k -f ogg";
                header("Content-Type: audio/ogg;codecs=opus");
                break;
            case "flac":
                // Force Settings for constant FLAC 16-bit CD quality
                $cmd .= " -ar 44100 -c:a flac -sample_fmt s16 -compression_level 7 -frame_size 4096 -f flac";
                header("Content-Type: audio/flac");
                break;
            case "mkv":
                $cmd .= " -c:a copy -f matroska -fflags +bitexact -flags:v +bitexact -flags:a +bitexact";
                header("Content-Type: video/x-matroska");
                break;
        }

        $cmd .= " pipe:1";

        set_time_limit(0);
        header("X-Command: " . $cmd);
        $fp = proc_open($cmd, [
            0 => ["pipe", "r"],
            1 => ["pipe", "w"],
            2 => ["pipe", "w"],
        ], $pipes);
        stream_set_blocking($pipes[2], false);

        $len = 0;
        $read = fread($pipes[1], 128);
        $len += strlen($read);
        if(strlen($read) > 0){
            echo $read;
            flush();
        }

        do{
            $read = fread($pipes[1], 4096);
            $len += strlen($read);
            fread($pipes[2], 1024);
            if(strlen($read) > 0){
                echo $read;
                flush();
            }
        }while(!connection_aborted() and $pipes[1] !== null and !feof($pipes[1]));

        fclose($pipes[0]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        proc_close($fp);

        foreach($tempFiles as $tmpName){
            @unlink($tmpName);
        }

        if($len === 0){
            $mimeType = "audio";
            $ext = strtolower(pathinfo($data["path"], PATHINFO_EXTENSION));
            if ($ext === "flac") {
                $mimeType = "audio/flac";
            } else if ($ext === "ogg") {
                $mimeType = "audio/ogg";
            } else if ($ext === "opus") {
                $mimeType = "audio/opus";
            } else if ($ext === "tta") {
                $mimeType = "audio/tta";
            } else if ($ext === "m4a") {
                $mimeType = "audio/mp4";
            } else if ($ext === "aac") {
                $mimeType = "audio/aac";
            } else if ($ext === "wav") {
                $mimeType = "audio/wav";
            } else if ($ext === "alac") {
                $mimeType = "audio/alac";
            } else if ($ext === "mp3") {
                $mimeType = "audio/mpeg;codecs=mp3";
            }
            header("Content-Type: $mimeType");
            flush();
            readfile($data["path"]);
        }

        break;
    }

}