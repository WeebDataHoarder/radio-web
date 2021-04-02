#!/usr/bin/env bash

emcc md5.c -O3 --pre-js preload.js -s WASM=1 -s FILESYSTEM=0 -s ENVIRONMENT=web -s SINGLE_FILE=1 -s EXPORTED_FUNCTIONS='["_MD5_Init","_MD5_Update","_MD5_Final","_MD5_Free","_malloc","_free"]' -s EXTRA_EXPORTED_RUNTIME_METHODS='["cwrap"]' -o ../static/js/md5asm.js
