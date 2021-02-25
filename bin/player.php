<?php

require_once("common.php");

$dbconn = connectToMusicDatabase();
if ($dbconn === null) {
    exit();
}


function processAlbumResults($result){
    $songs = [];

    $album = null;
    $artist = null;
    $discNumber = 1;
    $duration = 0;
    $image = null;

    foreach ($result as $data){
        $artist = $artist === null ? $data["artist"] : ($data["artist"] === $artist ? $artist : false);
        if (preg_match("#/([0-9]+)[\\- \\.]+[\\(\\[]?([0-9]+)[\\)\\\]?[ \t]*[\\.\\-_\\# ][^/]+\\.[a-z0-9]{2,6}$#ui", $data["path"], $matches) > 0) {
            $data["album"] = ($album = trim(str_ireplace(["part " . $matches[2], "cd " . $matches[2], "disc " . $matches[2],  "disk " . $matches[2], "box " . $matches[2]], "", $data["album"]), " \t:-"));
            $num = ltrim($matches[1], "0");
            $data["parentIndex"] = (int) $num;
            $data["index"] = (int) ltrim($matches[2], "0");
            if ($num > $discNumber) {
                $discNumber = (int)$num;
            }
            $data["sortTitle"] = str_pad($data["parentIndex"], 2, "0", STR_PAD_LEFT) . "-" . str_pad($data["index"], 2, "0", STR_PAD_LEFT) . ". " . $data["title"];
        } else if (preg_match("#/(part|cd|disc|disk|box)[ _\\-\\#]{0,2}([0-9]+)[^/]*/[\\(\\[]?([0-9]+)[\\)\\\]?[ \t]*[\\.\\-_\\# ][^/]+\\.[a-z0-9]{2,6}$#ui", $data["path"], $matches) > 0) {
            $data["album"] = ($album = trim(str_ireplace(["part " . $matches[2], "cd " . $matches[2], "disc " . $matches[2], "disk " . $matches[2], "box " . $matches[2]], "", $data["album"]), " \t:-"));
            $num = ltrim($matches[2], "0");
            $data["parentIndex"] = (int) $num;
            $data["index"] = (int) ltrim($matches[3], "0");
            if ($num > $discNumber) {
                $discNumber = (int)$num;
            }
            $data["sortTitle"] = str_pad($data["parentIndex"], 2, "0", STR_PAD_LEFT) . "-" . str_pad($data["index"], 2, "0", STR_PAD_LEFT) . ". " . $data["title"];
        } else if (preg_match("#/[\\(\\[]?([0-9]+)[\\)\\\]?[ \t]*[\\.\\-_ ][^/]+\\.[a-z0-9]{2,6}$#ui", $data["path"], $matches) > 0) {
            $data["index"] = (int) ltrim($matches[1], "0");
            $data["sortTitle"] = str_pad(1, 2, "0", STR_PAD_LEFT) . "-" . str_pad($data["index"], 2, "0", STR_PAD_LEFT) . ". " . $data["title"];
        }else {
            $data["sortTitle"] = str_pad(1, 2, "0", STR_PAD_LEFT) . "-" . basename($data["path"]);
        }

        $album = $data["album"];

        if(isset($data["index"])){
            $data["originalTitle"] = $data["title"];
            $data["title"] = str_pad($data["index"], 2, "0", STR_PAD_LEFT) . ". " . $data["title"];
        }
        if(isset($data["parentIndex"])){
            $data["originalAlbum"] = $data["album"];
            $data["album"] = $data["album"] . " - Disc " . str_pad($data["parentIndex"], 2, "0", STR_PAD_LEFT);
        }
        
        $duration += $data["duration"];
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
artists.name AS artist,
albums.name AS album,
songs.path AS path,
songs.duration AS duration,
songs.favorite_count AS favorite_count,
songs.play_count AS play_count,
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
SQL;
$tagSql = <<<SQL
SELECT
songs.id AS id,
songs.hash AS hash,
songs.title AS title,
artists.name AS artist,
albums.name AS album,
songs.path AS path,
songs.duration AS duration,
songs.favorite_count AS favorite_count,
songs.play_count AS play_count,
songs.cover AS cover,
array_to_json(ARRAY(SELECT jsonb_object_keys(songs.lyrics))) AS lyrics,
songs.status AS status,
array_to_json(ARRAY(SELECT tags.name FROM taggings JOIN tags ON (taggings.tag = tags.id) WHERE taggings.song = songs.id)) AS tags,
array_to_json(ARRAY(SELECT users.name FROM users JOIN favorites ON (favorites.user_id = users.id) WHERE favorites.song = songs.id)) AS favored_by
FROM songs
JOIN artists ON songs.artist = artists.id
JOIN albums ON songs.album = albums.id
WHERE EXISTS(SELECT 1 FROM taggings JOIN tags ON (taggings.tag = tags.id) WHERE taggings.song = songs.id AND tags.name = $1)
GROUP BY
songs.id,
songs.hash,
songs.title,
artists.name,
albums.name,
songs.path,
songs.duration,
songs.status
SQL;
$pathSql = <<<SQL
SELECT
songs.id AS id,
songs.hash AS hash,
songs.title AS title,
artists.name AS artist,
albums.name AS album,
songs.path AS path,
songs.duration AS duration,
songs.favorite_count AS favorite_count,
songs.play_count AS play_count,
songs.cover AS cover,
array_to_json(ARRAY(SELECT jsonb_object_keys(songs.lyrics))) AS lyrics,
songs.status AS status,
array_to_json(ARRAY(SELECT tags.name FROM taggings JOIN tags ON (taggings.tag = tags.id) WHERE taggings.song = songs.id)) AS tags,
array_to_json(ARRAY(SELECT users.name FROM users JOIN favorites ON (favorites.user_id = users.id) WHERE favorites.song = songs.id)) AS favored_by
FROM songs
JOIN artists ON songs.artist = artists.id
JOIN albums ON songs.album = albums.id
WHERE songs.path LIKE $1
GROUP BY
songs.id,
songs.hash,
songs.title,
artists.name,
albums.name,
songs.path,
songs.duration,
songs.status
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
        "ORDER BY (favorite_count * 5 + play_count + (CASE WHEN path ILIKE '%.flac' THEN 5 ELSE 0 END)) ASC, path ASC",
        "ORDER BY (favorite_count * 5 + play_count + (CASE WHEN path ILIKE '%.flac' THEN 5 ELSE 0 END)) DESC, path DESC",
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
    exit(0);
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
            $m3u .= "https://".SITE_HOSTNAME."/api/download/" . $data["hash"] . PHP_EOL . PHP_EOL;
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

header("Link: </css/foundation.min.css" . VERSION_HASH . "; rel=preload; as=style", false);
header("Link: </css/app.css" . VERSION_HASH . "; rel=preload; as=style", false);
header("Link: </css/player.css" . VERSION_HASH . "; rel=preload; as=style", false);
header("Link: </js/jquery.js" . VERSION_HASH . "; rel=preload; as=script", false);
header("Link: </js/player/aurora.js" . VERSION_HASH . "; rel=preload; as=script", false);
header("Link: </js/player/player.js" . VERSION_HASH . "; rel=preload; as=script", false);

?>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title><?php echo $title ?> :: anime(bits)</title>
    <meta name="google" content="notranslate"/>
    <meta property="og:site_name" content="anime(bits)">
    <meta property="og:type" content="<?php echo count($songs) > 1 ? "music.playlist" : "music.song"; ?>">
    <meta property="og:rich_attachment" content="true">
    <meta property="og:title" content="<?php echo $title; ?>">
    <?php
    $url = parse_url($_SERVER['REQUEST_URI']);
    echo '<!-- Fake this for youtube-dl <meta property="og:url" content="https://' . SITE_HOSTNAME . $url["path"] . "/m3u" . ((isset($url["query"]) and $url["query"] != "") ? "?" . $url["query"] . "&bandcamp.com" : "?bandcamp.com") . '"> -->' . PHP_EOL;
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

        /*
        if(!isRequestTheLounge()){

            ?>
            <meta property="music:song" content="https://radio.animebits.moe/player/hash/<?php echo $data["hash"]; ?>">
            <meta property="music:artist" content="<?php echo htmlspecialchars($data["artist"], ENT_QUOTES | ENT_HTML5, "UTF-8"); ?>">
            <meta property="music:album" content="<?php echo htmlspecialchars($data["album"], ENT_QUOTES | ENT_HTML5, "UTF-8"); ?>">
            <meta property="og:audio" content="https://radio.animebits.moe/api/download/<?php echo $data["hash"]; ?>">
            <meta property="og:audio:type" content="<?php echo $mimeType; ?>">
            <?php

        }
        ?>
        <meta property="og:image" content="https://radio.animebits.moe<?php echo ($data["cover"] !== null ? "/api/cover/" . $data["cover"] : "/img/no-cover.jpg"); ?>">
        <meta property="og:image:type" content="image/jpeg">
        <meta property="og:image:width" content="512">
        <meta property="og:image:height" content="512">
        <?php
        */
    }
    arsort($covers);
    $cover = array_key_first($covers);
    if ($favorited > 0) {
        $desc = "$desc :: $favorited total favorites";
    }
    ?>
    <meta property="og:image"
          content="https://<?php echo SITE_HOSTNAME . ($cover !== null ? "/api/cover/" . $cover . "/large" : "/img/no-cover.jpg"); ?>">
    <meta property="og:image:type" content="image/jpeg">
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

    <link rel="icon" sizes="128x128" href="/img/icon-128.png">
    <link rel="icon" sizes="192x192" href="/img/icon-192.png">
    <link rel="icon" sizes="256x256" href="/img/icon-256.png">
    <link rel="icon" sizes="512x512" href="/img/icon-512.png">
    <meta name="theme-color" content="#ed106a">

    <link rel="stylesheet" type="text/css" href="/css/foundation.min.css?<?php echo VERSION_HASH; ?>"/>
    <link rel="stylesheet" type="text/css" href="/css/app.css?<?php echo VERSION_HASH; ?>"/>
    <link rel="stylesheet" type="text/css" href="/css/player.css?<?php echo VERSION_HASH; ?>"/>

    <link rel="search" type="application/opensearchdescription+xml" title="anime(bits)" href="/search.xml"/>
    <link rel="search" type="application/opensearchdescription+xml" title="anime(bits) Album" href="/search-album.xml"/>
    <link rel="search" type="application/opensearchdescription+xml" title="anime(bits) Artist"
          href="/search-artist.xml"/>
    <?php
    if (count($covers) <= 1) {
        ?>
        <style type="text/css">
            div.song img.queue-cover {
                display: none !important;
            }

            div#radio-right div.song div.song-meta-data{
                max-width: calc(100% - 10px - 20px - 10px - 60px);
            }
        </style>
        <?php
    }

    if($albumView){
        ?>
        <style type="text/css">
            div#radio-right div.song div.song-meta-data span.song-album {
                display: none;
            }

            div#radio-right div.song img.queue-cover {
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

            div#radio-right div.album-header {
                display: flex;
                align-items: center;
                text-align: center;

                width: 100%;
                padding: 5px;
                margin-top: 20px;
                font-weight: bold;
                text-transform: uppercase;
                color: #999999;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            div#radio-right div.album-header::before, div#radio-right div.album-header::after {
                content: '';
                flex: 1;
                border-bottom: 2px solid #999999;
            }
            div#radio-right div.album-header::before {
                margin-right: .25em;
            }
            div#radio-right div.album-header::after {
                margin-left: .25em;
            }
            div#radio-right hr {
                display: none;
            }

        </style>
        <?php
    }else{
        ?>
        <style type="text/css">
            div#radio-right div.album-header {
                display: none;
            }
        </style>
        <?php
    }

    ?>
</head>
<body>
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
                <div class="hash-area np-hash" id="np-hash-cover"></div>
                <div class="tag-area" id="np-tags"></div>
                <img class="main-cover"
                     src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII="/>
                <div id="player-left-bottom">
                    <canvas id="lyrics-area"></canvas>
                    <div id="time-container">
							<span class="current-time">
								<span class="radio-current-minutes"></span>:<span class="radio-current-seconds"></span>
							</span>
                        <div id="progress-container">
                            <input type="range" class="radio-song-slider" value="0"/>
                            <progress id="song-played-progress" class="radio-song-played-progress" value="0"></progress>
                            <progress id="song-buffered-progress" class="radio-buffered-progress" value="0"></progress>
                        </div>
                        <span class="duration">
								<span class="radio-duration-minutes"></span>:<span
                                    class="radio-duration-seconds"></span>
							</span>
                    </div>

                    <div id="control-container">
                        <div id="repeat-container">
                            <div class="radio-repeat" id="repeat"></div>
                            <div class="radio-shuffle shuffle-off" id="shuffle"></div>
                        </div>

                        <div id="central-control-container">
                            <div id="central-controls">
                                <div class="radio-prev" id="previous"></div>
                                <div class="play-pause" id="play-pause"></div>
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
                        <span class="song-name"></span>

                        <div class="song-artist-album">
                            <span class="song-artist"></span>
                            <span class="song-album"></span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="large-6 medium-6 small-12 cell<?php echo (count($songs) > 1) ? "" : " single-player"; ?>"
                 id="radio-right">

            </div>
        </div>
    </div>
</div>


<script type="text/javascript" src="/js/jquery.js?<?php echo VERSION_HASH; ?>"
        nonce="<?php echo SCRIPT_NONCE; ?>"></script>
<script type="text/javascript" src="/js/player/aurora.js?<?php echo VERSION_HASH; ?>"
        nonce="<?php echo SCRIPT_NONCE; ?>"></script>
<script type="text/javascript" src="/js/player/player.js?<?php echo VERSION_HASH; ?>"
        nonce="<?php echo SCRIPT_NONCE; ?>"></script>
<script type="text/javascript" src="/js/kuroshiro.min.js?<?php echo VERSION_HASH; ?>"
        nonce="<?php echo SCRIPT_NONCE; ?>"></script>
<script type="text/javascript" src="/js/kuroshiro-analyzer-kuromoji.min.js?<?php echo VERSION_HASH; ?>"
        nonce="<?php echo SCRIPT_NONCE; ?>"></script>
<script type="text/javascript" src="/js/subtitles/subtitles-octopus.js?<?php echo VERSION_HASH; ?>"
        nonce="<?php echo SCRIPT_NONCE; ?>"></script>
<script type="text/javascript" nonce="<?php echo SCRIPT_NONCE; ?>">
    var kuroshiro = null;
    var kuroshiroInit = null;

    var subtitles = null;
    var subtitlesTimer = null;

    function resizeSubtitlesToMatchCanvas(timeout = true){
        if(subtitles === null){
            return;
        }
        var canvas = document.getElementById("lyrics-area");
        var ar = canvas.getAttribute("aspect-ratio");
        var canvasStyles = window.getComputedStyle(canvas);
        var width = canvasStyles.width.replace(/px$/, "");
        var height = canvasStyles.height.replace(/px$/, "");
        if(ar){
            var newHeight = String(Math.ceil(width / parseFloat(ar)));
            if(newHeight !== height){
                canvas.style.top = "-" + newHeight + "px";
                canvas.style.height = newHeight + "px";
                height = newHeight;
            }
        }

        var pixelRatio = "devicePixelRatio" in window ? window.devicePixelRatio : 1;
        subtitles.resize(width * pixelRatio, height * pixelRatio, 0, 0);

    }

    document.addEventListener("fullscreenchange", resizeSubtitlesToMatchCanvas, false);
    document.addEventListener("mozfullscreenchange", resizeSubtitlesToMatchCanvas, false);
    document.addEventListener("webkitfullscreenchange", resizeSubtitlesToMatchCanvas, false);
    document.addEventListener("msfullscreenchange", resizeSubtitlesToMatchCanvas, false);
    window.addEventListener("resize", resizeSubtitlesToMatchCanvas, false);

    var shuffledPlaylist = [];
    <?php
    $neededMimeTypes = [];
    $songPlaylist = [];
    $allowedTags = ["aotw" => true, "op" => true, "ed" => true, "touhou" => true, "vocaloid" => true, "soundtrack" => true, "remix" => true, "doujin" => true, "drama" => true, "alternative" => true, "house" => true, "ambient" => true, "eurobeat" => true, "symphogear" => true, "dance" => true, "trance" => true, "electronic" => true, "funk" => true, "gothic" => true, "jazz" => true, "metal" => true, "pop" => true, "rock" => true, "vocal" => true,];
    foreach ($songs as $index => $data) {
        $neededMimeTypes[$data["mimeType"]] = $data["mimeType"];
        $tags = [];
        foreach ($data["tags"] as $tag) {
            if (isset($allowedTags[$tag]) or stripos($tag, "catalog-") === 0) {
                $tags[] = $tag;
            }
        }

        $songPlaylist[] = ["title" => $data["title"], "artist" => $data["artist"], "album" => $data["album"], "url" => "/api/download/" . $data["hash"], "hash" => $data["hash"], "duration" => $data["duration"], "mime_type" => $data["mimeType"], "cover" => $data["cover"], "tags" => $tags, "lyrics" => $data["lyrics"]];
    }
    ?>

    var songPlaylist = <?php echo json_encode($songPlaylist, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK); ?>;

    var baseApiUrl = window.localStorage.getItem("radio-api-url") != null ? window.localStorage.getItem("radio-api-url") : location.protocol + '//' + document.domain + ':' + location.port;
    var currentLyrics = null;

    var showOriginalLyrics = !!(window.localStorage.getItem("lyrics-original") !== null ? parseInt(window.localStorage.getItem("lyrics-original")) : 0);
    var loadLyrics = !!(window.localStorage.getItem("lyrics-show") !== null ? parseInt(window.localStorage.getItem("lyrics-show")) : 1);
    var lyricsAnimationLevel = (window.localStorage.getItem("lyrics-animations") !== null ? parseInt(window.localStorage.getItem("lyrics-animations")) : 1); // 0 = no, 1 = all, 2 = only fade in/out

    var playing = false;
    const urlParams = new URLSearchParams(window.location.search);

    var uplayer = new UPlayer({
        "volume": window.localStorage.getItem("radio-volume") !== null ? window.localStorage.getItem("radio-volume") / 100 : 1.0,
        "preload": true,
        //"streaming": true,
        "forceCodec": urlParams.get("forceCodec") !== null ? true : navigator.userAgent.match(/(Macintosh|iOS|iPad|iPhone)((?!Chrom(ium|e)\/).)*$/) !== null,
        "muted": false,
        "retry": false,
        "limitCodecs": <?php echo json_encode(array_values($neededMimeTypes)); ?>,
        "play-pause-element": $(".play-pause"),
        "progress-minutes-element": $(".radio-current-minutes"),
        "progress-seconds-element": $(".radio-current-seconds"),
        "duration-minutes-element": $(".radio-duration-minutes"),
        "duration-seconds-element": $(".radio-duration-seconds"),
        "progress-element": $(".radio-song-played-progress"),
        "seek-element": $(".radio-song-slider"),
        "buffer-progress-element": $(".radio-buffered-progress"),
        "mute-element": $(".mute"),
        "volume-element": $(".volume-slider"),
        "on-end": function () {
            ++currentPlaylistIndex;
            if (currentPlaylistIndex >= songPlaylist.length) {
                if (repeat) {
                    currentPlaylistIndex = 0;
                } else {
                    return;
                }
            }
            playing = true;
            if (shuffle) {
                playThisSong(shuffledPlaylist[currentPlaylistIndex], true);
            } else {
                playThisSong(songPlaylist[currentPlaylistIndex], true);
            }
        },
        "on-pre-end": function () {
            index = currentPlaylistIndex + 1;
            if (index >= songPlaylist.length) {
                if (repeat) {
                    index = 0;
                } else {
                    return;
                }
            }
            playing = true;
            if (shuffle) {
                preloadThisSong(shuffledPlaylist[index], true);
            } else {
                preloadThisSong(songPlaylist[index], true);
            }
        },
        "on-ready": function () {
            if (playing) {
                uplayer.play(true);
            }
            //$(".play-pause").removeClass("hidden");
        },
        "on-progress": function () {
            var currentTime = uplayer.currentProgress * uplayer.totalDuration;
            if(subtitles !== null) {
                subtitles.setCurrentTime(currentTime);
            }
        }
    });


    $(".volume-slider").on("change", function () {
        window.localStorage.setItem("radio-volume", $(this).val());
    });

    $("#lyrics-area").on("click", () => {
       showOriginalLyrics = !showOriginalLyrics;
       window.localStorage.setItem("lyrics-original", showOriginalLyrics ? 1 : 0);
       if(currentLyrics !== null){
           if(currentLyrics.type === "timed"){
               createSubtitleFromEntries(currentLyrics.entries);
           }else if(currentLyrics.type === "ass"){

           }
       }
    });


    var songElement = $("div#radio-right").clone();
    for (var index = 0; index < songPlaylist.length; ++index) {
        var data = songPlaylist[index];
        if (<?php echo ($doSplit ? "true" : "false"); ?> && (index === 0 || songPlaylist[index - 1]["album"] !== data["album"])) {
            if(index > 0){
                songElement.append("<hr/>");
            }

            songElement.append('<div class="album-header">' + data["album"] + '</div>');
        }
        songElement.append('<div class="song radio-song-container" song-index="' + index + '" song-hash="' + data["hash"] + '">' +
            '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=" data-background-image="' + (data["cover"] !== null ? "/api/cover/" + data["cover"] + "/small" : "/img/no-cover.jpg") + '" class="queue-cover lazy-bg"/>' +
            '<div class="song-now-playing-icon-container">' +
            '<div class="play-button-container">' +
            '</div>' +
            '<img class="now-playing" src="/img/now-playing.svg"/>' +
            '</div>' +
            '<div class="song-meta-data">' +
            '<span class="song-title">' + document.createTextNode(data["title"]).data + '</span>' +
            '<span class="song-artist">' + document.createTextNode(data["artist"]).data + '</span>' +
            '<span class="song-album">' + document.createTextNode(data["album"]).data + '</span>' +
            '</div>' +
            '<span class="song-duration">' + uplayer.zeroPad(Math.floor(data["duration"] / 60), 2) + ':' + uplayer.zeroPad(data["duration"] % 60, 2) + '</span>' +
            '</div>');
    }
    $("div#radio-right").replaceWith(songElement);

    document.addEventListener("DOMContentLoaded", function() {
        var lazyBackgrounds = [].slice.call(document.querySelectorAll(".lazy-bg"));

        if ("IntersectionObserver" in window) {
            let lazyBackgroundObserver = new IntersectionObserver(function(entries, observer) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        entry.target.style["background-image"] = "url("+entry.target.getAttribute("data-background-image")+")";
                        lazyBackgroundObserver.unobserve(entry.target);
                    }
                });
            });

            lazyBackgrounds.forEach(function(lazyBackground) {
                lazyBackgroundObserver.observe(lazyBackground);
            });
        }
    });

    function shuffleArray(array) {
        for (var i = array.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
    }

    var currentPlaylistIndex = 0;
    var repeat = false;
    var shuffle = false;
    $(".radio-repeat").addClass("repeat-off");
    $(".radio-shuffle").addClass("shuffle-off");

    $(".radio-repeat").on("click", function () {
        if (repeat) {
            repeat = false;
            $(".radio-repeat").removeClass("repeat-on");
            $(".radio-repeat").addClass("repeat-off");
        } else {
            repeat = true;
            $(".radio-repeat").removeClass("repeat-off");
            $(".radio-repeat").addClass("repeat-on");
        }
    });

    $(".radio-shuffle").on("click", function () {
        if (shuffle) {
            shuffle = false;
            $(".radio-shuffle").removeClass("shuffle-on");
            $(".radio-shuffle").addClass("shuffle-off");
        } else {
            shuffle = true;
            $(".radio-shuffle").removeClass("shuffle-off");
            $(".radio-shuffle").addClass("shuffle-on");
            shuffledPlaylist = songPlaylist.slice();
            shuffleArray(shuffledPlaylist);
        }
    });

    jQuery(".hash-area").on('click', function () {
        var temp = jQuery("<input>");
        jQuery("body").append(temp);
        temp.val(jQuery(this).text()).select();
        document.execCommand("copy");
        temp.remove();
    });


    function nextSong() {
        ++currentPlaylistIndex;
        if (currentPlaylistIndex >= songPlaylist.length) {
            currentPlaylistIndex = 0;
        }
        if (shuffle) {
            playThisSong(shuffledPlaylist[currentPlaylistIndex]);
        } else {
            playThisSong(songPlaylist[currentPlaylistIndex]);
        }
    }

    function previousSong() {
        --currentPlaylistIndex;
        if (currentPlaylistIndex < 0) {
            currentPlaylistIndex = songPlaylist.length - 1;
        }
        if (shuffle) {
            playThisSong(shuffledPlaylist[currentPlaylistIndex]);
        } else {
            playThisSong(songPlaylist[currentPlaylistIndex]);
        }
    }

    $(".radio-next").on("click", nextSong);
    $(".radio-prev").on("click", previousSong);
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('nexttrack', nextSong);
        navigator.mediaSession.setActionHandler('previoustrack', previousSong);
    }

    $(".radio-song-container").on("click", function () {
        currentPlaylistIndex = parseInt($(this).attr("song-index"));
        playThisSong(songPlaylist[currentPlaylistIndex]);
    });


    function preloadThisSong(song, isPlaying = null) {
        console.log("Trying to preload next track " + song["url"]);
        uplayer.preload(song["url"], [song["mime_type"]]).then(e => {
            console.log("preloaded next song!");
        }).catch(e => {
            console.log("failed to preload: ");
            console.log(e);
        });
    }

    function loadKuroshiro(){
        if(kuroshiro === null){
            kuroshiro = new Kuroshiro();
            return kuroshiroInit = kuroshiro.init(new KuromojiAnalyzer({
                dictPath: "/dict/"
            }));
        }else{
            return kuroshiroInit;
        }
    }

    function loadLRCLyrics(data){
        resizeSubtitlesToMatchCanvas();

        currentLyrics = null;

        var lyricEntries = [];

        let lines = data.split("\n");
        var currentOffset = 0;
        var previousEntry = null;
        for(var i = 0; i < lines.length; ++i){
            var matches = lines[i].match(/\[(offset):([^\]]+)\]/);
            if(matches !== null){
                var type = matches[1].toLowerCase();
                var content = matches[2].trim();
                if(type === "offset"){
                    currentOffset = parseFloat(content) / 1000;
                }
            }else{
                matches = lines[i].match(/\[([^\]]+)\](.*)/);
                if(matches !== null){
                    var text = matches[2].trim();
                    var timeUnits = matches[1].split(":");
                    var time = parseFloat(timeUnits.pop()) || 0;
                    time += (parseFloat(timeUnits.pop()) * 60) || 0;
                    time += (parseFloat(timeUnits.pop()) * 3600) || 0;
                    time += currentOffset;

                    if(text.match(/^(作词|作曲|编曲|曲|歌|词)[ \t]*[：∶:]/)){
                        continue;
                    }

                    /*if(previousEntry === null && text === ""){
                        continue;
                    }else */if(previousEntry !== null && !previousEntry.end){
                        if(previousEntry.text === "" && text === ""){
                            continue;
                        }
                        previousEntry.end = time;
                    }

                    var subEntries = [];

                    var regex = /<([0-9:. ]+)>([^<]*)/g;
                    var result;
                    var prevSubEntry = null;
                    while((result = regex.exec(text)) !== null){
                        var subText = result[2];
                        var subTimeUnits = result[1].split(":");
                        var subTime = parseFloat(String(subTimeUnits.pop()).trim()) || 0;
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
        }

        var promises = [];

        for(var i = 0; i < lyricEntries.length; ++i){
            if(Kuroshiro.Util.hasJapanese(lyricEntries[i].text)){
                const currentObject = lyricEntries[i];
                if(currentObject.entries){
                    for(var k = 0; k < currentObject.entries.length; ++k){
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
        }

        Promise.all(promises).then(() => {
            currentLyrics = {
                type: "timed",
                entries: lyricEntries
            }

            createSubtitleFromEntries(lyricEntries);
        });
    }

    function convertJapaneseToRomaji(text){
        return new Promise((resolve, reject) => {
            loadKuroshiro().then(() => {
                kuroshiro.convert(text, {
                    to: "romaji",
                    mode: "spaced",
                    romajiSystem: "hepburn"
                }).then((result) => {
                    resolve(result)
                }).catch((e) => {
                    console.log(e);
                    resolve(text)
                });
            });
        })
    }
    
    function decodeASSEntry(input){
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
                    //charCode = (grouping[0] << 18) | (grouping[1] << 12) | (grouping[2] << 6) | grouping[3];
                    //output[writeOffset++] = (charCode >> 16) & 0xff;
                    //output[writeOffset++] = (charCode >> 8) & 0xff;
                    //output[writeOffset++] = charCode & 0xff;
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

    function createSubtitlesInstance(subsContent){
        if(subtitles !== null){
            subtitles.dispose();
            subtitles = null;
        }

        var fonts = {
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
        };

        var promises = [];

        var regex = /^fontnamev2:[ \t]*([^_]+)_([^,]*)\.([a-z0-9]{3,5}),[ \t]*(.+)$/mg;
        var result;
        while((result = regex.exec(subsContent)) !== null){
            var fontName = result[1];
            var fontProperties = result[2];
            var fontExtension = result[3];
            fonts[fontName.toLowerCase()] = result[4];
        }

        regex = /^fontname:[ \t]*([^_]+)_([^$]*)\.([a-z0-9]{3,5})((?:\r?\n[\x21-\x60]+)+)/mg;
        while((result = regex.exec(subsContent)) !== null){
            const currentResult = result;
            promises.push(new Promise(((resolve, reject) => {
                var fontName = currentResult[1];
                var fontProperties = currentResult[2];
                var fontExtension = currentResult[3];
                var blob = new Blob([decodeASSEntry(currentResult[4])], {type: "application/font-" + fontExtension.toLowerCase()});
                var reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.addEventListener("load", function () {
                    fonts[fontName.toLowerCase()] = reader.result;
                    resolve();
                }, false);
            })));
        }

        Promise.all(promises).then(() => {
            var canvas = document.getElementById("lyrics-area");

            var resolutionInformation = {
                aspectRatio: 10.6666667//1.777778
            };
            result = subsContent.match(/^PlayResX:[ \t]*([0-9]+)$/m);
            if(result !== null){
                resolutionInformation.x = parseInt(result[1]);
            }
            result = subsContent.match(/^PlayResY:[ \t]*([0-9]+)$/m);
            if(result !== null){
                resolutionInformation.y = parseInt(result[1]);
            }
            if(resolutionInformation.x && resolutionInformation.y){
                resolutionInformation.aspectRatio = resolutionInformation.x / resolutionInformation.y;
            }

            canvas.setAttribute("aspect-ratio", resolutionInformation.aspectRatio);
            result = subsContent.match(/^CanvasBackground:[ \t]*&H([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/m);

            var alpha = 0.4;
            var blue = 0;
            var green = 0;
            var red = 0;

            if(result !== null){
                alpha = parseInt(result[1], 16) / 255;
                blue = parseInt(result[2], 16) / 255;
                green = parseInt(result[3], 16) / 255;
                red = parseInt(result[4], 16) / 255;
            }
            canvas.style["background-color"] = "rgba("+red+", "+green+", "+blue+", "+alpha+")";

            if(subtitles !== null){
                subtitles.dispose();
            }
            subtitles = new SubtitlesOctopus({
                canvas: canvas,
                renderMode: typeof createImageBitmap !== 'undefined' ? "fast" : "normal",
                //renderMode: "blend",
                workerUrl: "/js/subtitles/subtitles-octopus-worker.js",
                legacyWorkerUrl: "/js/subtitles/subtitles-octopus-worker-legacy.js",
                availableFonts: fonts,
                subContent: subsContent,
                targetFps: 30,
                resizeVariation: 0.1,
                libassMemoryLimit: 40,
                libassGlyphLimit: 40,
                //renderAhead: 30,
                dropAllAnimations: lyricsAnimationLevel == 0,
                onReady: () => {
                    resizeSubtitlesToMatchCanvas(false);
                }
            });
            if(uplayer.playerObject !== null){
                if(uplayer.nativePlayback){
                    subtitles.setCurrentTime(uplayer.playerObject.currentTime);
                }else{
                    subtitles.setCurrentTime(uplayer.playerObject.currentTime / 1000);
                }
            }else{
                subtitles.setCurrentTime(0);
            }


            var updateFps = 30;

            if(subtitlesTimer !== null){
                clearInterval(subtitlesTimer);
            }
            subtitlesTimer = setInterval(() => {
                if(subtitles !== null && currentLyrics !== null && uplayer.isPlaying()){
                    if(uplayer.nativePlayback){
                        subtitles.setCurrentTime(uplayer.playerObject.currentTime);
                    }else{
                        subtitles.setCurrentTime(uplayer.playerObject.currentTime / 1000);
                    }
                }
            }, Math.floor(1 / updateFps * 1000));
            resizeSubtitlesToMatchCanvas(false);
        });
    }

    function createSubtitleFromEntries(lyricEntries){
        var subtitleFile = '[Script Info]\n' +
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
            'Video File: ?dummy:23.976000:40000:512:52:47:163:254:\n' +
            'Video AR Value: 5.000000\n' +
            '\n' +
            '[V4+ Styles]\n' +
            'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n' +
            'Style: Current,Open Sans,24,&H00FFFFFF,&H00B1B1B1,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,1,0,5,5,5,0,1\n' +
            '\n' +
            '[Events]\n' +
            'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
        var previousEntry = {
            text: "",
            start: 0,
            end: lyricEntries[0] ? lyricEntries[0].start : 0
        }

        var timeToStamp = (time) => {
            time = Math.max(time, 0);
            var hours = Math.floor(time / 3600);
            time = time - hours * 3600;
            var minutes = Math.floor(time / 60);
            var seconds = time - minutes * 60;
            function str_pad_left(string,pad,length) {
                return (new Array(length+1).join(pad)+string).slice(-length);
            }

            return hours + ":" + str_pad_left(minutes,'0',2)+':'+str_pad_left(Math.floor(seconds),'0',2) + "." + str_pad_left(Math.round((seconds - Math.floor(seconds)) * 100), '0', 2);
        }

        var pickText = (ob) => {
            return ((showOriginalLyrics && ob.originalText) ? ob.originalText : ob.text).replace(/[ ]+/g, ' ');
        }

        subtitleFile += 'Dialogue: 0,0:00:00.00,0:00:05.00,Current,,0,0,0,,{\\pos(1,1)\\alpha&FF}WARMUP\n'; //Do this to "pre-render"
        subtitleFile += 'Dialogue: 0,0:00:05.00,0:00:15.00,Current,,0,0,0,,{\\pos(1,1)\\alpha&FF}WARMUP\n'; //Do this to "pre-render"

        for(var i = 0; i < lyricEntries.length; ++i){
            const line = lyricEntries[i];
            //TODO: secondary line

            var entryLine = 'Dialogue: 1,' + timeToStamp(line.start) + ', ' + timeToStamp(line.end !== undefined ? line.end : line.start + 5) + ',Current,,0,0,0,,';
            var lineDuration = Math.max(1, Math.floor(((line.end !== undefined ? line.end : line.start + 5) - line.start) * 100));
            if(line.entries && line.entries.length > 0){
                entryLine += ((lyricsAnimationLevel > 0 && lineDuration > 50) ? '{\\fade(50,250)}' : '');
                for(var k = 0; k < line.entries.length; ++k){
                    var entry = line.entries[k];
                    var entryDuration = Math.max(1, Math.floor(((entry.end !== undefined  ? Math.min(line.end !== undefined  ? line.end : entry.end, entry.end) : (line.end !== undefined ? line.end : line.start + 5)) - entry.start) * 100));
                    entryLine += (lyricsAnimationLevel > 0 ? (lyricsAnimationLevel == 1 ? '{\\kf'+entryDuration+'}' : '{\\k'+entryDuration+'}') : '') + pickText(entry);
                }
            }else{
                var txt = pickText(line);
                if(txt.trim() === ""){
                    continue;
                }
                entryLine += '{'+(lineDuration > 50 ? '\\fade(50,250)' : '')+  (lyricsAnimationLevel > 0 ? (lyricsAnimationLevel == 1 ? '\\kf' + lineDuration : '\\k' + lineDuration) : '') + '}' + txt;
            }

            subtitleFile += entryLine + '\n';
        }
        createSubtitlesInstance(subtitleFile);

        return subtitleFile;
    }

    function tryLoadLyrics(song){
        if(loadLyrics){
            var preferredLyrics = ["ass", "timed"];
            var subtitleEntry = null;

            for(var index = 0; index < preferredLyrics.length; ++index){
                if(song.lyrics.includes(preferredLyrics[index])){
                    subtitleEntry = preferredLyrics[index];

                    jQuery.ajax(baseApiUrl + "/api/info/" + song.hash + "/lyrics/" + subtitleEntry, {
                        method: "GET",
                        async: true
                    }).done(function (data, status, xhr) {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            if(typeof data === "string"){
                                if(subtitleEntry === "timed"){
                                    loadLRCLyrics(data);
                                }else if(subtitleEntry === "ass"){
                                    currentLyrics = {
                                        type: "ass",
                                        entries: data
                                    }
                                    createSubtitlesInstance(data);
                                }
                            }
                        }
                    });

                    return;
                }
            }
        }


        if(subtitlesTimer !== null){
            clearInterval(subtitlesTimer);
            subtitlesTimer = null;
        }

        $("#lyrics-area").css("height", "0px");
        $("#lyrics-area").css("top", "-0px");

    }

    function playThisSong(song, isPlaying = null) {
        if (isPlaying === null) {
            playing = uplayer.isPlaying();
        } else {
            playing = isPlaying;
        }

        uplayer.init(song["url"], [song["mime_type"]]);
        var oldActiveElement = $(".active-song-container");
        var newActiveElement = $(".song[song-hash=\"" + song["hash"] + "\"]");
        if (oldActiveElement.length > 0 && newActiveElement.length > 0) {
            var oldBounds = oldActiveElement[0].getBoundingClientRect();
            if ((oldBounds.top >= 0 && oldBounds.bottom <= window.innerHeight) || (oldBounds.top < window.innerHeight && oldBounds.bottom >= 0)) {
                let newBounds = newActiveElement[0].getBoundingClientRect();
                if (!(newBounds.top >= 0 && newBounds.bottom <= window.innerHeight)) {
                    const yCoordinate = newBounds.top + window.pageYOffset;
                    const yOffset = -40;
                    window.scrollTo({
                        top: yCoordinate + yOffset,
                        behavior: 'smooth'
                    });
                }
            }
        }
        oldActiveElement.removeClass("active-song-container");
        newActiveElement.addClass("active-song-container");
        $(".main-cover").css("background-image", "url(" + (song["cover"] !== null ? "/api/cover/" + song["cover"] + "/large" : "/img/no-cover.jpg") + ")");
        $("#meta-container .song-name").html(song["title"]);
        $("#meta-container .song-album").html(song["album"]);
        $("#meta-container .song-artist").html(song["artist"]);
        $(".np-hash").text(song["hash"]);

        jQuery("#np-tags.tag-area").html("");

        tryLoadLyrics(song);

        if ("tags" in song) {
            var catalog = null;

            var miscTags = [];
            var miscPriority = 100;
            var allowedMiscTags = {
                aotw: 1,
                op: 1,
                ed: 1
            };


            var classTags = [];
            var classPriority = 100;
            var allowedClassTags = {
                touhou: 1,
                vocaloid: 1,
                eurobeat: 1,
                soundtrack: 2,
                remix: 3,
                symphogear: 3,
                doujin: 4,
                drama: 4
            };


            var genreTags = [];
            var genrePriority = 100;
            var allowedGenreTags = {
                alternative: 1,
                house: 1,
                dance: 1,
                trance: 1,
                ambient: 1,
                electronic: 2,
                funk: 1,
                gothic: 1,
                jazz: 1,
                metal: 1,
                pop: 2,
                rock: 1,
                vocal: 1
            };
            for (var i = 0; i < song.tags.length; ++i) {
                var tag = song.tags[i];
                var matches = null;
                if ((matches = tag.match(/^catalog\-(.+)$/i)) !== null) {
                    catalog = matches[1].toUpperCase();
                } else if (tag in allowedMiscTags) {
                    if (allowedMiscTags[tag] === miscPriority) {
                        miscPriority = allowedMiscTags[tag];
                        miscTags.push(tag);
                    } else if (allowedMiscTags[tag] < miscPriority) {
                        miscPriority = allowedMiscTags[tag];
                        miscTags = [];
                        miscTags.push(tag);
                    }
                } else if (tag in allowedClassTags) {
                    if (allowedClassTags[tag] === classPriority) {
                        classPriority = allowedClassTags[tag];
                        classTags.push(tag);
                    } else if (allowedClassTags[tag] < classPriority) {
                        classPriority = allowedClassTags[tag];
                        classTags = [];
                        classTags.push(tag);
                    }
                } else if (tag in allowedGenreTags) {
                    if (allowedGenreTags[tag] === genrePriority) {
                        genrePriority = allowedGenreTags[tag];
                        genreTags.push(tag);
                    } else if (allowedGenreTags[tag] < genrePriority) {
                        genrePriority = allowedGenreTags[tag];
                        genreTags = [];
                        genreTags.push(tag);
                    }
                }
            }

            if (catalog !== null) {
                var targetSearch = "https://musicbrainz.org/search?advanced=1&type=release&query=" + encodeURIComponent("catno:" + catalog);
                if (song.tags.includes('touhou')) {
                    targetSearch = "https://thwiki.cc/index.php?setlang=en&search=" + encodeURIComponent("incategory:同人专辑 (" + catalog + ")");
                } else if (song.tags.includes('soundtrack') || song.tags.includes('doujin') || song.tags.includes('remix') || song.tags.includes('ed') || song.tags.includes('op')) {
                    targetSearch = "https://vgmdb.net/search?q=" + encodeURIComponent(catalog);
                } else if (song.tags.includes('vocaloid')) {
                    targetSearch = "https://vocadb.net/Search?searchType=Album&filter=" + encodeURIComponent(catalog);
                } else if (song.tags.includes('eurobeat')) {
                    targetSearch = "http://www.dancegroove.net/database/search.php?mode=cd&catalog=" + encodeURIComponent(catalog);
                } else if (song.tags.includes('pop')) {
                    //targetSearch = "https://www.discogs.com/search/?type=release&catno=" + encodeURIComponent(catalog);
                }

                var newTag = $(document.createElement("div"));
                newTag.addClass("tag");
                newTag.addClass("tag-catalog-" + catalog);
                newTag.text(catalog);
                newTag.on('mousedown', function (a) {
                    if (a.ctrlKey || (a.which == 2 || a.button == 2)) {
                        window.open(targetSearch, '_blank');
                        a.stopImmediatePropagation();
                        return;
                    }
                    var temp = jQuery("<input>");
                    jQuery("body").append(temp);
                    temp.val(jQuery(this).text()).select();
                    document.execCommand("copy");
                    temp.remove();
                });
                jQuery("#np-tags.tag-area").append(newTag);
            }

            for (var i = 0; i < classTags.length; ++i) {
                var newTag = $(document.createElement("div"));
                newTag.addClass("tag");
                newTag.addClass("tag-" + classTags[i]);
                newTag.text(classTags[i]);
                jQuery("#np-tags.tag-area").append(newTag);
            }

            for (var i = 0; i < genreTags.length; ++i) {
                var newTag = $(document.createElement("div"));
                newTag.addClass("tag");
                newTag.addClass("tag-" + genreTags[i]);
                newTag.text(genreTags[i]);
                jQuery("#np-tags.tag-area").append(newTag);
            }

            for (var i = 0; i < miscTags.length; ++i) {
                var newTag = $(document.createElement("div"));
                newTag.addClass("tag");
                newTag.addClass("tag-" + miscTags[i]);
                newTag.text(miscTags[i]);
                jQuery("#np-tags.tag-area").append(newTag);
            }
        }

        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: song["title"],
                artist: song["artist"],
                album: song["album"],
                artwork: [
                    {
                        src: location.protocol + '//' + document.domain + ':' + location.port + (song["cover"] !== null ? "/api/cover/" + song["cover"] + "/large" : "/img/no-cover.jpg"),
                        sizes: '800x800',
                        type: 'image/jpeg'
                    },
                    {
                        src: location.protocol + '//' + document.domain + ':' + location.port + (song["cover"] !== null ? "/api/cover/" + song["cover"] + "/small" : "/img/no-cover.jpg"),
                        sizes: '55x55',
                        type: 'image/jpeg'
                    }
                ]
            });
        }
        if (playing) {
            uplayer.play(true);
            if ("Notification" in window) {
                if (Notification.permission === "granted") {
                    var n = new Notification(song.title, {
                        icon: (song["cover"] !== null ? "/api/cover/" + song["cover"] + "/small" : "/img/no-cover.jpg"),
                        image: (song["cover"] !== null ? "/api/cover/" + song["cover"] + "/large" : "/img/no-cover.jpg"),
                        body: "by " + song.artist + " from " + song.album,
                        silent: true,
                        requireInteraction: false,
                        tag: "player." + window.location.hostname
                    });
                    n.onclick = function () {
                        window.focus();
                    };
                    setTimeout(n.close.bind(n), 5000);
                }
            }
        }
    }

    playThisSong(songPlaylist[currentPlaylistIndex]);
</script>
</body>
</html>
