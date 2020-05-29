<?php

require_once("common.php");

$key = getAuthenticationKey();
if($key === null){
    header('HTTP/1.1 403 Forbidden');
	echo("You need to authenticate on main page before using the Favorite Import service");
	exit();
}

$dbconn = connectToMusicDatabase();
if($dbconn === null){
	exit();
}

$user = checkAuthenticationKey($dbconn, $key);
if($user === null){
    header('HTTP/1.1 403 Forbidden');
	echo("You need to authenticate on main page before using the Favorite Import service");
	exit();
}

if(isset($_GET["user"])){
  $result = getLastFmFavorites($_GET["user"]);
  $json = [];
  foreach($result as $t){
    $json[] = [
      "title" => $t["name"],
      "artist" => $t["artist"]["name"],
    ];
  }
  if(count($json) > 0){
    header("Content-Type: application/json");
    echo json_encode($json, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit();
  }
}

header('HTTP/1.1 404 Not Found');
exit();
