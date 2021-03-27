<?php

use Limelight\Limelight;

require_once("common.php");

$dbconn = connectToMusicDatabase();
if ($dbconn === null) {
    exit();
}




function convertLRCtoEntries($data){
        $lyricEntries = [];

        $lines = explode("\n", $data);
        $currentOffset = 0;
        $previousEntry = null;
        foreach ($lines as $line){
            if(preg_match("/\[(offset):([^\]]+)\]/u", $line, $matches) > 0){
                $type = strtolower($matches[1]);
                $content = trim($matches[2]);
                if($type === "offset"){
                    $currentOffset = floatval($content) / 1000;
                }
            }elseif(preg_match("/\[([^\]]+)\](.*)/u", $line, $matches) > 0){
                $text = trim($matches[2]);
                $timeUnits = explode(":", $matches[1]);
                $time = floatval(array_pop($timeUnits));
                $time += floatval(array_pop($timeUnits)) * 60;
                $time += floatval(array_pop($timeUnits)) * 3600;
                $time += $currentOffset;

                if(preg_match("/^(作词|作曲|编曲|曲|歌|词)[ \t]*[：∶:]/u", $text)){
                    continue;
                }
                if($previousEntry !== null && !isset($previousEntry->end)){
                    if($previousEntry->text === "" && $text === ""){
                        continue;
                    }
                    $previousEntry->end = $time;
                }

                $subEntries = [];
                
                $prevSubEntry = null;
                if(preg_match_all("/<([0-9:. ]+)>([^<]*)/u", $text, $results)){
                    foreach ($results[1] as $i => $t){
                        $subText = $results[2][$i];
                        $subTimeUnits = explode(":", $t);
                        $subTime = floatval(array_pop($subTimeUnits));
                        $subTime += floatval(array_pop($subTimeUnits)) * 60;
                        $subTime += floatval(array_pop($subTimeUnits)) * 3600;
                        $subTime += $currentOffset;
                        
                        if($prevSubEntry !== null && !$prevSubEntry->end){
                            $prevSubEntry->end = $subTime;
                        }
                        
                        $subEntries[] = $prevSubEntry = (object) [
                            "text" => $subText,
                            "start" => $subTime
                        ];
                    }
                }

                $lyricEntries[] = $previousEntry = (object) [
                    "text" => preg_replace("/<[^>]+>/u", "", $text),
                    "start" => $time
                ];
                if(count($subEntries)){
                    $previousEntry->entries = $subEntries;
                }
            }
        }
        
        return $lyricEntries;
    }


    function createASSFromEntries($lyricEntries, $duration){
        $playResX = 512;
        $playResY = 512;

        $areaX = $playResX;
        $areaY = (int) min(floor($playResX / 8), $playResY);

        $fontSize = 24;

        $subtitleFile = "[Script Info]\n" .
        "Title: Lyrics\n" .
        "ScriptType: v4.00+\n" .
        "Collisions: Normal\n" .
        "WrapStyle: 0\n" .
        "ScaledBorderAndShadow: yes\n" .
        "YCbCr Matrix: None\n" .
        "PlayResX: 512\n" .
        "PlayResY: 512\n" .
        "Timer: 100.0000\n" .
        "PlayDepth: 0\n" .
        "\n" .
        "[Aegisub Project Garbage]\n" .
        "Last Style Storage: Default\n" .
        "Video File: ?dummy:30:40000:512:512:47:163:254:\n" .
        "Video AR Value: 5.000000\n" .
        "\n" .
        "[V4+ Styles]\n" .
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n" .
        "Style: Current,Open Sans,$fontSize,&H00FFFFFF,&H00B1B1B1,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,1,0,2,10,10,".floor(($areaY / 2) - ($fontSize / 2)).",1\n" .
        "Style: BG,Open Sans,$fontSize,&H66000000,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,0,0,0,1\n" .
        "\n" .
        "[Events]\n" .
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n";

        $timeToStamp = function ($time) {
            $time = max($time, 0);
            $hours = floor($time / 3600);
            $time = $time - $hours * 3600;
            $minutes = floor($time / 60);
            $seconds = $time - $minutes * 60;

            return $hours . ":" . str_pad($minutes, 2, '0',  STR_PAD_LEFT) . ':' . str_pad(floor($seconds), 2, '0',  STR_PAD_LEFT) . "." . str_pad(round(($seconds - floor($seconds)) * 100), 2, '0',  STR_PAD_LEFT);
        };

        $pickText = function($ob) {
            return preg_replace("/[ ]+/", " ", $ob->text);
        };

        $currentBackgroundTime = 0; //TODO: have multiple per song

        foreach ($lyricEntries as $line){
            
            //TODO: secondary line

            $lineEnd = $line->end ?? ($line->start + 5);
            $entryLine = 'Dialogue: 1,' . $timeToStamp($line->start) . ', ' . $timeToStamp($lineEnd) . ',Current,,0,0,0,,';
            $lineDuration = max(1, floor((($line->end ?? ($line->start + 5)) - $line->start) * 100));
            if(isset($line->entries) && count($line->entries) > 0){
                $entryLine .= '{\\fade(50,250)}';
                foreach ($line->entries as $entry){
                    $entryDuration = max(1, floor(((isset($entry->end) ? min($lineEnd, $entry->end) : $lineEnd) - $entry->start) * 100));
                    $entryLine .= '{\\kf'.$entryDuration.'}' . $pickText($entry);
                }
            }else{
                $txt = $pickText($line);
                if(trim($txt) === ""){
                    continue;
                }
                $entryLine .= '{'.($lineDuration > 50 ? '\\fade(50,250)' : '') . '\\kf' . $lineDuration . '}' . $txt;
            }

            $subtitleFile .= $entryLine . "\n";
       
        }


        $subtitleFile .= 'Dialogue: 0,' . $timeToStamp($currentBackgroundTime) . ', ' . $timeToStamp($duration) . ',BG,,0,0,0,,{\\p1}m 0 0 l '.$areaX.' 0 '.$areaX.' '.$areaY.' 0 '.$areaY;

        return $subtitleFile;
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
songs.lyrics AS lyrics,
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
                $cmd .= " -i " . escapeshellarg(DEFAULT_API_URL . "cover/" . $data["cover"] ."/original") . " ";
            }

            $subs = null;
            if(isset($data["lyrics"]["ass"])){
                $subs = [tempnam("/tmp", "encode_"), $data["lyrics"]["ass"]];
            }else if(isset($data["lyrics"]["timed"])){
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
                $cmd .= " -i " . $subs[0] . " ";

                $multiplier = (int) max(1, ceil( ($playResX / $playResY) > 2 ? 2048 / $playResX : 1024 / $playResY));

                $playResX *= $multiplier;
                $playResY *= $multiplier;

                $cmd .= " -f lavfi -i 'color=size={$playResX}x{$playResY}:rate=30:duration=".$data["duration"].":color=black' ";
                if($data["cover"] !== null){
                    $params .=  "-map 2:s -disposition:s:0 forced -filter_complex '[1:v]scale=w=-1:h={$playResY}[cover];[3:v][cover]overlay=eof_action=repeat[out]' -map '[out]' -pix_fmt yuv420p -c:v libx264 -preset:v ultrafast -profile:v high -tune:v stillimage -crf 40 -x264opts \"keyint=900:min-keyint=900:no-scenecut\" ";
                }else{
                    $params .=  "-map 1:s -disposition:s:0 forced -filter_complex -map 2:v -pix_fmt yuv420p -c:v libx264 -preset:v ultrafast -profile:v high -tune:v stillimage -crf 40 -x264opts \"keyint=900:min-keyint=900:no-scenecut\" ";

                }
            }else{
                $params .= "-map 1:v ";
            }
            $cmd .= $params;
        }else{
            $cmd .= " -map_metadata -1 -map 0:a -filter_complex 'volume=volume=1.0:replaygain=track' -ac 2 ";
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
                $cmd .= " -c:a copy -f matroska";
                header("Content-Type: video/x-matroska");
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
        flush();

        do{
            echo fread($pipes[1], 4096);
            fread($pipes[2], 1024);
            flush();
        }while(!connection_aborted() and $pipes[1] !== null and !feof($pipes[1]));

        fclose($pipes[0]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        proc_close($fp);

        foreach($tempFiles as $tmpName){
            @unlink($tmpName);
        }

        break;
    }

}