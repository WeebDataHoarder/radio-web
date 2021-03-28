<?php

require_once("vendor/autoload.php");

setlocale(LC_CTYPE, "en_US.UTF-8");
define("VERSION_HASH", substr(md5(file_get_contents(__DIR__ . "/../.version")), 0, 8));
define("SCRIPT_NONCE", isset($_SERVER["HTTP_X_NONCE"]) ? bin2hex(hex2bin($_SERVER["HTTP_X_NONCE"])) : null);

require_once("config.php");


function getAuthenticationKey(){
  $key = null;
	if(isset($_GET["apikey"]) and $_GET["apikey"] !== ""){
		$key = $_GET["apikey"];
	}else if(isset($_SERVER["PHP_AUTH_PW"]) and $_SERVER["PHP_AUTH_PW"] !== ""){
		$key = $_SERVER["PHP_AUTH_PW"];
	}else if(isset($_SERVER["PHP_AUTH_USER"]) and $_SERVER["PHP_AUTH_USER"] !== ""){
		$key = $_SERVER["PHP_AUTH_USER"];
	}else if(isset($_SERVER["HTTP_AUTHORIZATION"]) and $_SERVER["HTTP_AUTHORIZATION"] !== ""){
		$key = $_SERVER["HTTP_AUTHORIZATION"];
	}else if(isset($_COOKIE["radio-apikey"]) and $_COOKIE["radio-apikey"] !== ""){
		$key = $_COOKIE["radio-apikey"];
	}

  return $key !== null ? urldecode($key) : $key;
}

function checkAuthenticationKey($dbconn, $key){
  $result = pg_query_params($dbconn, 'SELECT "user" as id, (SELECT "name" FROM users WHERE "id" = "user") as "name", (SELECT "user_metadata" FROM users WHERE "id" = "user") as "user_metadata" FROM user_api_keys WHERE key = $1;', [$key]);
  if($row = pg_fetch_array($result, null, PGSQL_ASSOC)) {
    if(!isset($row["id"]) or $row["id"] <= 0){
      return null;
    }
    return $row;
  }
  return null;
}

function connectToTorrentDatabase(){
  if(!($dbconn = pg_connect(POSTGRES_CONNECTION_STRING_TORRENTS))){
  	return null;
  }
  return $dbconn;
}

function connectToMusicDatabase(){
  if(!($dbconn = pg_connect(POSTGRES_CONNECTION_STRING_MUSIC))){
  	return null;
  }
  return $dbconn;
}

if (!function_exists('array_key_first')) {
    function array_key_first(array $arr) {
        foreach($arr as $key => $unused) {
            return $key;
        }
        return NULL;
    }
}

function getLastFmFavorites($user){
  $page = 1;
  $results = [];
  do{
    $result = @json_decode(file_get_contents("https://ws.audioscrobbler.com/2.0/?method=user.getlovedtracks&limit=1000&api_key=".LASTFM_API_KEY."&format=json&page=$page&user=" . urlencode($user)), true);
    $page++;
    if(!isset($result["lovedtracks"])){
      break;
    }
    foreach ($result["lovedtracks"]["track"] as $track) {
      $results[$track["mbid"]] = [
        "artist" => [
          "mbid" => $track["artist"]["mbid"],
          "name" => $track["artist"]["name"]
        ],
        "name" => $track["name"],
        "mbid" => $track["mbid"],
      ];
    }

  }while(isset($result["lovedtracks"]) and $result["lovedtracks"]["@attr"]["page"] < $result["lovedtracks"]["@attr"]["totalPages"]);


  return $results;
}

function getMBReleaseByTrack($mbid){
  $result = @json_decode(file_get_contents("https://musicbrainz.org/ws/2/release?track=" . urlencode($mbid)), true);
  if(!isset($result["lovedtracks"])){
    return [];
  }
  return [];
}

function isRequestTheLounge(){
  return @stripos($_SERVER['HTTP_USER_AGENT'], "thelounge") !== false;
}

function isRequestSatsuki(){
  return @stripos($_SERVER['HTTP_USER_AGENT'], "kana/") === 0;
  //return isset($_COOKIE["PREF"]) and $_COOKIE["PREF"] == "f6=42008";
}

function isRequestMediaPlayer(){
    return isRequestVideoPlayer() or
        @stripos($_SERVER['HTTP_USER_AGENT'], "lavf/") === 0 or //ffplay
        (isset($_SERVER['HTTP_ICY_METADATA']) and $_SERVER['HTTP_ICY_METADATA'] === "1"); //others?
}

function isRequestVideoPlayer(){
    return isRequestVLC() or isRequestMPV();
}

function isRequestVLC(){
    return @stripos($_SERVER['HTTP_USER_AGENT'], "libvlc") !== false;
}

function isRequestMPV(){
    return @stripos($_SERVER['HTTP_USER_AGENT'], "libmpv") !== false or @stripos($_SERVER['HTTP_USER_AGENT'], "mpv ") === 0;
}