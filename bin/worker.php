<?php
require_once("common.php");

header("Content-Type: application/javascript; charset=UTF-8");

echo '"use strict";' . PHP_EOL;
echo 'const cacheName = "default-'.VERSION_HASH.'";' . PHP_EOL;

readfile(__DIR__ . "/worker-dep.js");
