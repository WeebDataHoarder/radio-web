<?php

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
artists.name AS artist,
albums.name AS album,
songs.path AS path,
songs.duration AS duration,
songs.cover AS cover,
array_to_json(ARRAY(SELECT jsonb_object_keys(songs.lyrics))) AS lyrics,
songs.status AS status,
array_to_json(ARRAY(SELECT tags.name FROM taggings JOIN tags ON (taggings.tag = tags.id) WHERE taggings.song = songs.id)) AS tags,
array_to_json(ARRAY(SELECT users.name FROM users JOIN favorites ON (favorites.user_id = users.id) WHERE favorites.song = songs.id)) AS favored_by
FROM songs
JOIN artists ON songs.artist = artists.id
JOIN albums ON songs.album = albums.id
WHERE songs.hash LIKE $1
GROUP BY
songs.id,
songs.hash,
songs.title,
artists.name,
albums.name,
songs.path,
songs.duration,
songs.status
ORDER BY album ASC, path ASC
;
SQL;

$actualPath = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);

if (preg_match("#^/service/encode/(?P<hash>[a-fA-F0-9]{8,32})(|/(?P<codec>(m4a|aac|mp3|opus|flac)))$#", $actualPath, $matches) > 0) {
    $hash = $matches["hash"];
    $codec = $matches["codec"] ?? null;

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

        $cmd .= " -map_metadata -1 -map 0:a -filter_complex 'volume=volume=1.0:replaygain=track' -ac 2 ";

        header("Transfer-encoding: chunked");
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
        }
        flush();

        $cmd .= " pipe:1";

        set_time_limit(0);
        header("X-Command: " . $cmd);
        $fp = proc_open($cmd, [
            0 => ["pipe", "r"],
            1 => ["pipe", "w"],
            2 => ["pipe", "w"],
        ], $pipes);
        stream_set_blocking($pipes[2], false);

        echo fread($pipes[1], 128);
        ob_flush();

        do{
            echo fread($pipes[1], 4096);
            fread($pipes[2], 1024);
            flush();
        }while(!connection_aborted() and $pipes[1] !== null and !feof($pipes[1]));

        fclose($pipes[0]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        proc_close($fp);

        break;
    }

}