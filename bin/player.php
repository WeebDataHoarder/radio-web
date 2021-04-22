<?php

require_once("common.php");

$dbconn = connectToMusicDatabase();
if ($dbconn === null) {
    http_response_code(500);
    exit();
}

function sanitizeAlbumName($name, $indexMatch){
    return trim(preg_replace("#(part|cd|disc|disk|box)[ _\t\\-]*?0*$indexMatch#ui", "", $name), " \t:-");
}

function processAlbumResults($result){
    $songs = [];

    $album = null;
    $artist = null;
    $discNumber = 1;
    $duration = 0;
    $image = null;



    $matchFunctions = [
        "#/(?<parentIndex>[0-9]+)[\\- \\.]+[\\(\\[]?(?<index>[0-9]+)[\\)\\\]?[ \t]*[\\.\\-_\\# ][^/]+\\.[a-z0-9]{2,6}$#ui" => function($matches, &$data){
            $data["parentIndex"] = (int) ltrim($matches["parentIndex"], "0");
            $data["album"] = sanitizeAlbumName($data["album"], $data["parentIndex"]);
            $data["index"] = (int) ltrim($matches["index"], "0");
            $data["sortTitle"] = str_pad($data["parentIndex"], 2, "0", STR_PAD_LEFT) . "-" . str_pad($data["index"], 2, "0", STR_PAD_LEFT) . ". " . $data["title"];
        },
        "#/(part|cd|disc|disk|box)[ _\\-\\#]{0,2}(?<parentIndex>[0-9]+)[^/]*/[\\(\\[]?(?<index>[0-9]+)[\\)\\\]?[ \t]*[\\.\\-_\\# ][^/]+\\.[a-z0-9]{2,6}$#ui" => function($matches, &$data, &$album){
            $data["parentIndex"] = (int) ltrim($matches["parentIndex"], "0");
            $data["album"] = sanitizeAlbumName($data["album"], $data["parentIndex"]);
            $data["index"] = (int) ltrim($matches["index"], "0");
            $data["sortTitle"] = str_pad($data["parentIndex"], 2, "0", STR_PAD_LEFT) . "-" . str_pad($data["index"], 2, "0", STR_PAD_LEFT) . ". " . $data["title"];
        },
        "#/[\\(\\[]?(?<index>[0-9]+)[\\)\\\]?[ \t]*[\\.\\-_ ][^/]+\\.[a-z0-9]{2,6}$#ui" => function($matches, &$data, &$album){
            $data["parentIndex"] = 1;
            $data["index"] = (int) ltrim($matches["index"], "0");
            $data["sortTitle"] = str_pad(1, 2, "0", STR_PAD_LEFT) . "-" . str_pad($data["index"], 2, "0", STR_PAD_LEFT) . ". " . $data["title"];
        },
        "#.#ui" => function($matches, &$data, &$album){
            $data["parentIndex"] = 1;
            $data["sortTitle"] = str_pad(1, 2, "0", STR_PAD_LEFT) . "-" . basename($data["path"]);
        }
    ];


    $bestMatches = [];
    foreach ($matchFunctions as $regex => $function){
        $bestMatches[$regex] = 0;
    }

    foreach ($result as $data){
        foreach ($matchFunctions as $regex => $function){
            if(preg_match($regex, $data["path"]) > 0){
                $bestMatches[$regex]++;
                break;
            }
        }
    }

    $regex = array_keys($bestMatches, max($bestMatches))[0];

    foreach ($result as $i => $data){
        if(preg_match($regex, $data["path"], $matches) > 0){
            $matchFunctions[$regex]($matches, $data, $album);
        }else{
            //TODO: handle these errors?
            $data["parentIndex"] = 1;
            $data["sortTitle"] = basename($data["path"]);
        }

        if ($data["parentIndex"] > $discNumber) {
            $discNumber = $data["parentIndex"];
        }

        $album = $data["album"];
        $duration += $data["duration"];
        $result[$i] = $data;
    }

    foreach ($result as $data){
        if(isset($data["index"])){
            $data["originalTitle"] = $data["title"];
            $data["title"] = str_pad($data["index"], 2, "0", STR_PAD_LEFT) . ". " . $data["title"];
        }
        if($discNumber > 1 and isset($data["parentIndex"])){
            $data["originalAlbum"] = $data["album"];
            $data["album"] = $data["album"] . " - Disc " . str_pad($data["parentIndex"], 2, "0", STR_PAD_LEFT);
        }
        $songs[] = $data;
    }

    usort($songs, function($a, $b){
        return strcasecmp($a["album"] . "/" . $a["sortTitle"], $b["album"] . "/" . $b["sortTitle"]);
    });

    return (object) [
        "songs" => $songs,
        "title" => $album,
        "artist" => $artist === false ? null : $artist,
        "duration" => $duration,
        "discs" => $discNumber
    ];
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
songs.favorite_count AS favorite_count,
songs.play_count AS play_count,
songs.cover AS cover,
array_to_json(ARRAY(SELECT jsonb_object_keys(songs.lyrics))) AS lyrics,
songs.status AS status,
array_to_json(ARRAY(SELECT tags.name FROM tags JOIN taggings ON (taggings.tag = tags.id) WHERE taggings.song = songs.id)) AS tags,
array_to_json(ARRAY(SELECT users.name FROM users JOIN favorites ON (favorites.user_id = users.id) WHERE favorites.song = songs.id)) AS favored_by
FROM songs
WHERE songs.hash LIKE $1
SQL;
$tagSql = <<<SQL
SELECT
songs.id AS id,
songs.hash AS hash,
songs.title AS title,
(SELECT artists.name FROM artists WHERE songs.artist = artists.id LIMIT 1) AS artist,
(SELECT albums.name FROM albums WHERE songs.album = albums.id LIMIT 1) AS album,  
songs.path AS path,
songs.duration AS duration,
songs.favorite_count AS favorite_count,
songs.play_count AS play_count,
songs.cover AS cover,
array_to_json(ARRAY(SELECT jsonb_object_keys(songs.lyrics))) AS lyrics,
songs.status AS status,
array_to_json(ARRAY(SELECT tags.name FROM tags JOIN taggings ON (taggings.tag = tags.id) WHERE taggings.song = songs.id)) AS tags,
array_to_json(ARRAY(SELECT users.name FROM users JOIN favorites ON (favorites.user_id = users.id) WHERE favorites.song = songs.id)) AS favored_by
FROM songs
WHERE songs.id IN(SELECT song FROM taggings WHERE taggings.tag = (SELECT id FROM tags WHERE tags.name = $1))
SQL;
$pathSql = <<<SQL
SELECT
songs.id AS id,
songs.hash AS hash,
songs.title AS title,
(SELECT artists.name FROM artists WHERE songs.artist = artists.id LIMIT 1) AS artist,
(SELECT albums.name FROM albums WHERE songs.album = albums.id LIMIT 1) AS album,  
songs.path AS path,
songs.duration AS duration,
songs.favorite_count AS favorite_count,
songs.play_count AS play_count,
songs.cover AS cover,
array_to_json(ARRAY(SELECT jsonb_object_keys(songs.lyrics))) AS lyrics,
songs.status AS status,
array_to_json(ARRAY(SELECT tags.name FROM tags JOIN taggings ON (taggings.tag = tags.id) WHERE taggings.song = songs.id)) AS tags,
array_to_json(ARRAY(SELECT users.name FROM users JOIN favorites ON (favorites.user_id = users.id) WHERE favorites.song = songs.id)) AS favored_by
FROM songs
WHERE songs.path LIKE $1
SQL;
$queue = [];
$songs = [];

$favorited = 0;
$plays = 0;
$albumView = false;
$title = "";
$desc = "";

$playlistFormat = null;

$orderBy = [
    "albumPath" => [
        "ORDER BY album ASC, path ASC",
        "ORDER BY album DESC, path DESC"
    ],
    "score" => [
        "ORDER BY score ASC, path ASC",
        "ORDER BY score DESC, path DESC",
    ],
    "title" => [
        "ORDER BY title ASC, path ASC",
        "ORDER BY title DESC, path DESC"
    ],
    "favorites" => [
        "ORDER BY favorite_count ASC, path ASC",
        "ORDER BY favorite_count DESC, path DESC"
    ],
    "plays" => [
        "ORDER BY play_count ASC, path ASC",
        "ORDER BY play_count DESC, path DESC"
    ]
];

$defaultOrderBy = "albumPath";
$extraParams = "";

$doSplit = true;

if(isset($_GET["orderBy"]) and isset($orderBy[$_GET["orderBy"]])){
    $extraParams .= "&orderBy=" . $_GET["orderBy"];
    if($_GET["orderBy"] !== "albumPath" and $_GET["orderBy"] !== "default"){
        $doSplit = false;
    }
}
if(isset($_GET["orderDirection"]) and strtolower($_GET["orderDirection"]) === "desc"){
    $extraParams .= "&orderDirection=" . $_GET["orderDirection"];
}

$orderBySel = (isset($_GET["orderBy"]) and isset($orderBy[$_GET["orderBy"]])) ? $orderBy[$_GET["orderBy"]] : $orderBy[$defaultOrderBy];
$orderByString = (isset($_GET["orderDirection"]) and strtolower($_GET["orderDirection"]) === "desc") ? $orderBySel[1] : $orderBySel[0];


$actualPath = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);

if (preg_match("#(.*)[/\\.]m3u(\\?.*|)$#iu", $actualPath, $matches) > 0) {
    $playlistFormat = "m3u";
    $_SERVER["REQUEST_URI"] = $matches[1] . $matches[2];
} else if (preg_match("#(.*)[/\\.]m3u8(\\?.*|)$#iu", $actualPath, $matches) > 0) {
    $playlistFormat = "m3u8";
    $_SERVER["REQUEST_URI"] = $matches[1] . $matches[2];
} else if (preg_match("#(.*)[/\\.]pls(\\?.*|)$#iu", $actualPath, $matches) > 0) {
    $playlistFormat = "pls";
    $_SERVER["REQUEST_URI"] = $matches[1] . $matches[2];
} else if (isRequestMediaPlayer()){
    $playlistFormat = "m3u";
}


$actualPath = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);

if (preg_match("#^/player/hash/(([a-fA-F0-9]{8,32},?)+)(\\?.*|)$#", $actualPath, $matches) > 0) {
    foreach (explode(",", $matches[1]) as $h) {
        $queue[strtolower($h)] = strtolower($h);
    }
    $desc = "Playlist (" . count($queue) . ")";
} elseif (preg_match("#^/player/favorites/([^/ ]+)(\\?.*|)$#", $actualPath, $matches) > 0) {
    foreach (@json_decode(file_get_contents(DEFAULT_API_URL . "/favorites/" . strtolower($matches[1]) . "?apikey=" . DEFAULT_API_KEY . $extraParams), true) as $data) {
        $songs[] = $data;
    }
    $title = strtolower($matches[1]) . "'s favorites";
    $desc = strtolower($matches[1]) . "'s favorites (" . count($songs) . ")";
} elseif (preg_match("#^/player/search/(.+)(\\?.*|)$#", $actualPath, $matches) > 0) {
    foreach (explode("/", $matches[1]) as $bq) {
        $q = urldecode($bq);
        foreach (@json_decode(file_get_contents(DEFAULT_API_URL . "/search?limit=1500&q=" . urlencode($q) . "&apikey=" . DEFAULT_API_KEY . $extraParams), true) as $data) {
            $songs[] = $data;
        }
        $title = $q;
        $desc = "'" . $q . "' search (" . count($songs) . ")";
        if (count($songs) > 0) {
            break;
        }
    }
} elseif (preg_match("#^/player/(album)/([^\\?]+)(\\?.*|)$#", $actualPath, $matches) > 0) {
    $q = urldecode($matches[2]);
    $type = $matches[1];
    $albumView = true;
    $q = "$type:\"$q\"";

    $result = processAlbumResults(@json_decode(file_get_contents(DEFAULT_API_URL . "/search?limit=1500&q=" . urlencode($q) . "&apikey=" . DEFAULT_API_KEY . $extraParams), true));
    $duration = $result->duration;
    $discNumber = $result->discs;
    $album = $result->title;
    $artist = $result->artist;
    $songs = array_merge($songs, $result->songs);

    $title = $album . "" . (($artist !== false and $artist !== null) ? " by " . $artist : "") . " :: " . count($songs) . " tracks" . ($discNumber > 1 ? ", $discNumber discs" : "") . ", " . floor($duration / 60) . "m";
} elseif (preg_match("#^/player/catalog/(.+?)(\\?.*|)$#iu", $actualPath, $matches) > 0) {
    $q = strtolower(urldecode($matches[1]));
    $result = pg_query_params($dbconn, $tagSql . " " . $orderByString . ";", ["catalog-$q"]);
    $albumView = true;

    $results = [];
    while ($data = pg_fetch_row($result, null, PGSQL_ASSOC)) {
        foreach ($data as $k => &$v) {
            if ($k === "tags" or $k === "favored_by" or $k === "lyrics") {
                $v = json_decode($v, true);
            }
        }

        $results[] = $data;
    }

    $result = processAlbumResults($results);
    $duration = $result->duration;
    $discNumber = $result->discs;
    $album = $result->title;
    $artist = $result->artist;
    $songs = array_merge($songs, $result->songs);


    $title = $album . "" . (($artist !== false and $artist !== null) ? " by " . $artist : "") . " [" . strtoupper($q) . "] :: " . count($songs) . " tracks" . ($discNumber > 1 ? ", $discNumber discs" : "") . ", " . floor($duration / 60) . "m";
} elseif (preg_match("#^/player((/(ab|jps|red|bbt)[gt]/[0-9]+)+)(\\?.*|)$#iu", $actualPath, $matches) > 0) {
    if (preg_match_all("#/(ab|jps|red|bbt)(g|t)/([0-9]+)#i", $matches[1], $m) > 0) {
        $entries = [];

        foreach ($m[1] as $matchIndex => $tag) {
            $type = $m[2][$matchIndex];
            $q = urldecode($m[3][$matchIndex]);
            $entries[] = [
                "tag" => $tag,
                "type" => $type,
                "q" => $q,
                "params" => [$tagSql . " " . $orderByString . ";", ["$tag$type-$q"]]
            ];
            $entries[] = [
                "tag" => $tag,
                "type" => $type,
                "q" => $q,
                "params" => [$pathSql . " " . $orderByString . ";", ["%/[$tag$type-$q]/%"]]
            ];
        }

        foreach ($entries as $entry){
            $tag = $entry["tag"];
            $type = $entry["type"];
            $q = $entry["q"];

            $result = pg_query_params($dbconn, ...($entry["params"]));
            $albumView = true;

            $results = [];
            while ($data = pg_fetch_row($result, null, PGSQL_ASSOC)) {
                foreach ($data as $k => &$v) {
                    if ($k === "tags" or $k === "favored_by" or $k === "lyrics") {
                        $v = json_decode($v, true);
                    }
                }
                $results[] = $data;
            }

            $result = processAlbumResults($results);
            $duration = $result->duration;
            $discNumber = $result->discs;
            $album = $result->title;
            $artist = $result->artist;
            $songs = array_merge($songs, $result->songs);

            $title = $album . "" . (($artist !== false and $artist !== null) ? " by " . $artist : "") . " [" . strtoupper($tag) . strtolower($type) . "#$q] :: " . count($songs) . " tracks" . ($discNumber > 1 ? ", $discNumber discs" : "") . ", " . floor($duration / 60) . "m";
            if (count($songs) > 0) {
                break;
            }
        }
    }
} elseif (preg_match("#^/player/(ab|jps|red|bbt)(s|a)/([0-9]+)(\\?.*|)$#iu", $actualPath, $matches) > 0) {
    $q = urldecode($matches[3]);
    $tag = $matches[1];
    $type = $matches[2];
    $result = pg_query_params($dbconn, $tagSql . " " . $orderByString . ";", ["$tag$type-$q"]);
    $album = strtoupper($tag) . strtolower($type) . "#$q";
    $albumView = true;


    $results = [];
    while ($data = pg_fetch_row($result, null, PGSQL_ASSOC)) {
        foreach ($data as $k => &$v) {
            if ($k === "tags" or $k === "favored_by" or $k === "lyrics") {
                $v = json_decode($v, true);
            }
        }
        $results[] = $data;
    }

    $result = processAlbumResults($results);
    $duration = $result->duration;
    $discNumber = $result->discs;
    $artist = $result->artist;
    $songs = array_merge($songs, $result->songs);

    $title = $album . "" . (($artist !== false and $artist !== null) ? " by " . $artist : "") . " [" . strtoupper($tag) . strtolower($type) . "#$q] :: " . count($songs) . " tracks, " . floor($duration / 60) . "m";
} else {
    http_response_code(404);
    exit();
}

$covers = [];

if (count($queue) > 0) {
    foreach ($queue as $hash) {


        $result = pg_query_params($dbconn, $hashSql . " " . $orderByString . ";", [$hash . "%"]);
        while ($data = pg_fetch_row($result, null, PGSQL_ASSOC)) {
            foreach ($data as $k => &$v) {
                if ($k === "tags" or $k === "favored_by" or $k === "lyrics") {
                    $v = json_decode($v, true);
                }
            }
            $songs[] = $data;
        }
    }

}

if (count($songs) === 0) {
    http_response_code(404);
    exit();
}


header("Vary: User-Agent");

if($playlistFormat === null){
    header("Link: </css/foundation.min.css?".VERSION_HASH.">; rel=preload; as=style", false);
    header("Link: </css/app.css?".VERSION_HASH.">; rel=preload; as=style", false);
    header("Link: </css/player.css?".VERSION_HASH.">; rel=preload; as=style", false);
    header("Link: </js/player/aurora.js?".VERSION_HASH.">; rel=preload; as=script", false);
    header("Link: </js/player/player.js?".VERSION_HASH.">; rel=preload; as=script", false);
    header("Link: </js/utils.js?".VERSION_HASH.">; rel=preload; as=script", false);
    header("Link: </js/offline.js?".VERSION_HASH.">; rel=preload; as=script", false);
    flush();
}


if (count($songs) === 1) {
    $data = $songs[0];
    $duration = floor($data["duration"] / 60) . ":" . str_pad($data["duration"] % 60, 2, "0", STR_PAD_LEFT);
    $tags = [];
    foreach ($data["tags"] as $key => $value) {
        if (!(preg_match("/^(ab|jps|red|bbt)([gtsa])\\-([0-9]+)$/iu", $value, $matches) > 0) and !(preg_match("/^playlist\\-([a-z0-9\\-_]+)$/", $value, $matches)) > 0 and !(preg_match("/^catalog\\-(.+)$/", $value, $matches)) > 0) {
            $tags[] = "#" . $value;
        }
    }
    $tagStr = implode(", ", $tags);
    $title = $data["title"] . " by " . $data["artist"] . " [$duration]" . " :: " . ((isset($data["lyrics"]) and (in_array("timed", $data["lyrics"], true) or in_array("ass", $data["lyrics"], true))) ? "🎤 :: " : "") . $tagStr;
    $desc = $data["artist"] . " - " . $data["title"] . " (" . $data["album"] . ")" . " [$duration]" . " :: " . ((isset($data["lyrics"]) and (in_array("timed", $data["lyrics"], true) or in_array("ass", $data["lyrics"], true))) ? "🎤 :: " : "") . $tagStr;
} elseif (count($songs) < 10 and $title === "") {
    $title = [];
    $desc = [];
    foreach ($songs as $s) {
        $title[] = $s["title"];
        $duration = floor($s["duration"] / 60) . ":" . str_pad($s["duration"] % 60, 2, "0", STR_PAD_LEFT);
        $desc[] = $s["artist"] . " - " . $s["title"] . " (" . $s["album"] . ")" . " [$duration]";
    }
    $title = implode(", ", $title);
    $desc = implode("\r\n", $desc);
}

if ($title === "") {
    $title = "anime(bits)";
}

if ($desc == "") {
    $desc = $title;
}

if (!isRequestSatsuki() and !isRequestTheLounge() and $playlistFormat !== null) {
    if ($playlistFormat === "m3u" or $playlistFormat === "m3u8") {
        $m3u = "#EXTM3U" . PHP_EOL . PHP_EOL;
        if (strpos($_SERVER["REQUEST_URI"], "soundcloud.com") !== false) {
            $m3u .= "#EXT-X-STREAM-INF:CODECS=\"mp3,opus,vorbis,flac\",AUDIO=\"audio\"" . PHP_EOL . PHP_EOL;
        }
        $m3u .= "#PLAYLIST:$title" . PHP_EOL;
        if($albumView){
            if(isset($album) and $album !== false){
                $m3u .= "#EXTALB:" . $album . PHP_EOL;
            }
            if(isset($artist) and $artist !== false){
                $m3u .= "#EXTART:" . $artist . PHP_EOL;
            }
        }

        $doMatroska = isRequestVideoPlayer();

        foreach ($songs as $k => $data) {
            if($albumView){
                $m3u .= "#EXTINF:" . $data["duration"] . ", " . $data["artist"] . " - " . (isset($data["originalTitle"]) ? $data["originalTitle"] : $data["title"]) . PHP_EOL;
            }else{
                $m3u .= "#EXTINF:" . $data["duration"] . ", " . $data["artist"] . " - " . $data["title"] . " (" . $data["album"] . ")" . PHP_EOL;
                $m3u .= "#EXTART:" . $data["album"] . PHP_EOL;
                $m3u .= "#EXTALB:" . $data["artist"] . PHP_EOL;
            }
            if($data["cover"] !== null){
                $m3u .= "#EXTALBUMARTURL:" . "https://".SITE_HOSTNAME."/api/cover/".$data["cover"]."/large" . PHP_EOL;
                $m3u .= "#EXTIMG:" . "https://".SITE_HOSTNAME."/api/cover/".$data["cover"]."/large" . PHP_EOL;
            }
            $m3u .= ($doMatroska and (($data["cover"] !== null and isRequestMPV()) or count($data["lyrics"]) > 0)) ? "https://".SITE_HOSTNAME."/service/encode/" . $data["hash"] . "/mkv" . PHP_EOL . PHP_EOL : "https://".SITE_HOSTNAME."/api/download/" . $data["hash"] . PHP_EOL . PHP_EOL;
        }
        $hash = hash("sha256", $m3u);

        header("ETag: \"$hash\"");
        header("Content-Type: application/mpegurl; charset=utf-8");
        header('Content-Disposition: attachment; filename="' . $hash . '.'.$playlistFormat.'"');
        header('Content-Length: ' . strlen($m3u));
        echo $m3u;
        exit();
    } else if ($playlistFormat === "pls") {
        $pls = "[playlist]" . PHP_EOL . PHP_EOL;
        $index = 1;
        foreach ($songs as $k => $data) {
            $pls .= "File$index=https://".SITE_HOSTNAME."/api/download/" . $data["hash"] . PHP_EOL;
            $pls .= "Title$index=" . $data["artist"] . " - " . $data["title"] . " (" . $data["album"] . ")" . PHP_EOL;
            $pls .= "Length$index=" . $data["duration"] . PHP_EOL . PHP_EOL;
            $index++;
        }
        $pls .= "NumberOfEntries=" . ($index - 1) . PHP_EOL;
        $pls .= "Version=2" . PHP_EOL;
        $hash = hash("sha256", $pls);

        header("ETag: \"$hash\"");
        header("Content-Type: audio/x-scpls; charset=utf-8");
        header('Content-Disposition: attachment; filename="' . $hash . '.pls"');
        header('Content-Length: ' . strlen($pls));
        echo $pls;
        exit();
    }
}

$title = htmlspecialchars($title, ENT_QUOTES | ENT_HTML5, "UTF-8");

if (isRequestSatsuki()) {
    $title = "Join #radio ~ $title";
}

foreach ($songs as $k => $data) {
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
    $songs[$k]["mimeType"] = $mimeType;
    @$covers[(int)$data["cover"]]++;
    $favorited += count($data["favored_by"]);
}

reset($songs);

header("Link: <".(current($songs)["cover"] !== null ? "/api/cover/" . current($songs)["cover"] . "/large" : "/img/no-cover.webp").">; rel=preload; as=image; type=image/webp", false);
header("Link: </api/download/".current($songs)["hash"].">; rel=preload; as=auto; type=".current($songs)["mimeType"], false);
flush();

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title><?php echo $title ?> :: anime(bits)</title>
    <meta name="google" content="notranslate"/>
    <meta property="og:site_name" content="anime(bits)">
    <?php
    if(count($songs) > 1){
        ?>
        <meta property="og:type" content="<?php echo $albumView ? "music.album" : "music.playlist" ?>">
        <?php
    }else{
        ?>
        <meta property="og:type" content="music.song">
        <meta property="music:duration" content="<?php echo current($songs)["duration"]; ?>">
        <?php
    }
    ?>
    <meta property="og:type" content="<?php echo count($songs) > 1 ? "music.playlist" : "music.song"; ?>">
    <meta property="og:rich_attachment" content="true">
    <meta property="og:title" content="<?php echo $title; ?>">
    <?php
    $url = parse_url($_SERVER['REQUEST_URI']);
    echo '<!-- Fake this for youtube-dl <meta property="og:url" content="https://' . SITE_HOSTNAME . $url["path"] . "/m3u" . ((isset($url["query"]) and $url["query"] != "") ? "?" . $url["query"] . "&bandcamp.com" : "?bandcamp.com") . '"> -->' . PHP_EOL;
    arsort($covers);
    $cover = array_key_first($covers);
    if ($favorited > 0) {
        $desc = "$desc :: $favorited total favorites";
    }
    ?>
    <meta property="og:image"
          content="https://<?php echo SITE_HOSTNAME . ($cover !== null ? "/api/cover/" . $cover . "/large" : "/img/no-cover.webp"); ?>">
    <meta property="og:image:type" content="image/webp">
    <meta property="og:image:width" content="800">
    <meta property="og:image:height" content="800">
    <meta property="og:url"
          content="https://<?php echo SITE_HOSTNAME . htmlspecialchars($_SERVER["REQUEST_URI"], ENT_QUOTES | ENT_HTML5, "UTF-8"); ?>">
    <meta property="og:description"
          content="<?php echo str_replace("\r\n", "&#10;&#13;", htmlspecialchars($desc, ENT_QUOTES | ENT_HTML5, "UTF-8")); ?>">
    <meta name="description"
          content="<?php echo str_replace("\r\n", "&#10;&#13;", htmlspecialchars($desc, ENT_QUOTES | ENT_HTML5, "UTF-8")); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="no-referrer">

    <link rel="icon" sizes="128x128" href="/img/icon-128.webp">
    <link rel="icon" sizes="192x192" href="/img/icon-192.webp">
    <link rel="icon" sizes="256x256" href="/img/icon-256.webp">
    <link rel="icon" sizes="512x512" href="/img/icon-512.webp">
    <meta name="theme-color" content="#ed106a">

    <link rel="manifest" href="/manifest.webmanifest?<?php echo VERSION_HASH; ?>">
    <link rel="stylesheet" type="text/css" href="/css/foundation.min.css?<?php echo VERSION_HASH; ?>" nonce="<?php echo SCRIPT_NONCE; ?>"/>
    <link rel="stylesheet" type="text/css" href="/css/app.css?<?php echo VERSION_HASH; ?>" nonce="<?php echo SCRIPT_NONCE; ?>"/>
    <link rel="stylesheet" type="text/css" href="/css/player.css?<?php echo VERSION_HASH; ?>" nonce="<?php echo SCRIPT_NONCE; ?>"/>

    <link rel="search" type="application/opensearchdescription+xml" title="anime(bits)" href="/search.xml"/>
    <link rel="search" type="application/opensearchdescription+xml" title="anime(bits) Album" href="/search-album.xml"/>
    <link rel="search" type="application/opensearchdescription+xml" title="anime(bits) Artist" href="/search-artist.xml"/>

    <style type="text/css" nonce="<?php echo SCRIPT_NONCE; ?>">
    <?php
    if (count($covers) <= 1) {
        ?>
        div.song img.queue-cover, div.song .queue-fit {
            display: none !important;
        }

        div#radio-right div.song div.song-meta-data{
            max-width: calc(100% - 10px - 20px - 10px - 60px);
        }
        <?php
    }

    if($albumView){
        ?>
        div#radio-right div.song div.song-meta-data span.song-album {
            display: none;
        }

        div#radio-right div.song .queue-fit {
            height: 42px;
            width: 42px;
        }

        div#radio-right div.song {
            height: 42px;
        }

        div#radio-right div.song span.song-duration {
            line-height: 39px;
        }

        div#radio-right div.song div.song-meta-data span.song-artist {
            padding-left: 4ch;
        }
        div#radio-right hr {
            display: none;
        }

        <?php
    }else{
        ?>
        div#radio-right div.album-header, div#radio-right div.album-header::before, div#radio-right div.album-header::after {
            display: none;
        }
        <?php
    }

    ?>
    </style>
</head>
<body>
<div class="body-blur" style="background-image: url(<?php echo current($songs)["cover"] !== null ? "/api/cover/" . current($songs)["cover"] . "/large" : "/img/no-cover.webp"; ?>)"></div>
<div class="grid-x" id="blue-playlist-container">
    <div class="large-12 medium-12 small-12 cell" id="title-bar">
        <img src="/img/title.svg" id="radio-title"/>
        <p class="title-menu">

        </p>
    </div>
    <div class="large-10 medium-12 small-11 large-centered medium-centered small-centered cell<?php echo (count($songs) > 1) ? "" : " single-player"; ?>"
         id="radio-player">
        <div class="grid-x">
            <div class="<?php echo (count($songs) > 1) ? "large-6 medium-6 small-12" : "large-12 medium-12 small-12"; ?> cell"
                 id="radio-left">
                <div class="hash-area np-hash" id="np-hash-cover"><?php echo current($songs)["hash"]; ?></div>
                <div class="tag-area" id="np-tags"></div>
                <div class="cover-fit-container">
                    <img class="main-cover" src="<?php echo current($songs)["cover"] !== null ? "/api/cover/" . current($songs)["cover"] . "/large" : "/img/no-cover.webp"; ?>"/>
                </div>
                <div id="player-left-bottom">
                    <canvas id="lyrics-area"></canvas>
                    <div id="time-container">
							<span class="current-time">
								<span class="radio-current-minutes">00</span>:<span class="radio-current-seconds">00</span>
							</span>
                        <div id="progress-container">
                            <input type="range" class="radio-song-slider" value="0"/>
                            <progress id="song-played-progress" class="radio-song-played-progress" value="0"></progress>
                            <progress id="song-buffered-progress" class="radio-buffered-progress" value="0"></progress>
                        </div>
                        <span class="duration">
								<span class="radio-duration-minutes">00</span>:<span class="radio-duration-seconds">00</span>
							</span>
                    </div>

                    <div id="control-container">
                        <div id="repeat-container">
                            <div class="radio-repeat repeat-off" id="repeat"></div>
                            <div class="radio-shuffle shuffle-off" id="shuffle"></div>
                        </div>

                        <div id="central-control-container">
                            <div id="central-controls">
                                <div class="radio-prev" id="previous"></div>
                                <div class="play-pause paused" id="play-pause"></div>
                                <div class="radio-next" id="next"></div>
                            </div>
                        </div>

                        <div id="volume-container">
                            <div class="volume-controls">
                                <div class="mute not-muted"></div>
                                <input type="range" class="volume-slider"/>
                                <div class="ms-range-fix"></div>
                            </div>
                            <div class="radio-shuffle shuffle-off" id="shuffle-right"></div>
                        </div>
                    </div>


                    <div id="meta-container">
                        <span class="song-name"><?php echo htmlspecialchars(current($songs)["title"], ENT_QUOTES | ENT_HTML5, "UTF-8"); ?></span>

                        <div class="song-artist-album">
                            <span class="song-artist"><?php echo htmlspecialchars(current($songs)["artist"], ENT_QUOTES | ENT_HTML5, "UTF-8"); ?></span>
                            <span class="song-album"><?php echo htmlspecialchars(current($songs)["album"], ENT_QUOTES | ENT_HTML5, "UTF-8"); ?></span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="large-6 medium-6 small-12 cell<?php echo (count($songs) > 1) ? "" : " single-player"; ?>" id="radio-right">
                <div class="album-header" style="display: block">Loading track list...</div>
            </div>
        </div>
    </div>
</div>

<script type="text/javascript" src="/js/player/aurora.js?<?php echo VERSION_HASH; ?>"
        nonce="<?php echo SCRIPT_NONCE; ?>"></script>
<script type="text/javascript" src="/js/player/player.js?<?php echo VERSION_HASH; ?>"
        nonce="<?php echo SCRIPT_NONCE; ?>"></script>
<script type="text/javascript" src="/js/utils.js?<?php echo VERSION_HASH; ?>"
        nonce="<?php echo SCRIPT_NONCE; ?>"></script>
<script type="text/javascript" nonce="<?php echo SCRIPT_NONCE; ?>">
    <?php
    $neededMimeTypes = [];
    $songPlaylist = [];
    $allowedTags = ["aotw" => true, "op" => true, "ed" => true, "touhou" => true, "vocaloid" => true, "soundtrack" => true, "remix" => true, "doujin" => true, "drama" => true, "alternative" => true, "house" => true, "ambient" => true, "eurobeat" => true, "symphogear" => true, "dance" => true, "trance" => true, "electronic" => true, "funk" => true, "gothic" => true, "jazz" => true, "metal" => true, "pop" => true, "rock" => true, "hip.hop" => true, "vocal" => true,];
    $prevEntry = null;
    foreach ($songs as $index => $data) {
        $neededMimeTypes[$data["mimeType"]] = $data["mimeType"];
        $tags = [];
        foreach ($data["tags"] as $tag) {
            if (isset($allowedTags[$tag]) or stripos($tag, "catalog-") === 0) {
                $tags[] = $tag;
            }
        }

        $centry = $entry = ["title" => $data["title"], "artist" => $data["artist"], "album" => $data["album"], "hash" => $data["hash"], "duration" => $data["duration"], "mime" => $data["mimeType"], "cover" => $data["cover"], "tags" => $tags];
        if(count($data["lyrics"]) > 0){
            $entry["lyrics"] = $data["lyrics"];
        }
        if($prevEntry !== null){
            foreach (["artist", "album", "mime", "cover", "tags"] as $k){
                if($entry[$k] === $prevEntry[$k]){
                    unset($entry[$k]);
                }
            }
        }

        $songPlaylist[] = $entry;
        $prevEntry = $centry;
    }
    ?>

    const songPlaylist = <?php echo json_encode($songPlaylist, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK); ?>;
    const limitCodecs = <?php echo json_encode(array_values($neededMimeTypes), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK); ?>;
    const doSplitPlayer = <?php echo ($doSplit ? "true" : "false"); ?>;
    const VERSION_HASH = "<?php echo VERSION_HASH; ?>";

    if ('serviceWorker' in navigator) {
        if(window.localStorage.getItem("radio-skip-worker") === "yes"){
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for(let registration of registrations) {
                    registration.unregister();
                }
            });
        }else{
            window.addEventListener('load', function() {
                navigator.serviceWorker.register('/service-worker.js?<?php echo VERSION_HASH; ?>').then(function(registration) {
                    console.log('registered service worker');
                    registration.update();
                }, function(err) {
                    console.log('registration failed: ', err);
                });
            });
        }
    }

</script>
<script type="text/javascript" src="/js/offline.js?<?php echo VERSION_HASH; ?>"
        nonce="<?php echo SCRIPT_NONCE; ?>"></script>
</body>
</html>
