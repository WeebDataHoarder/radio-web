#!/usr/bin/env bash

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

pushd "${ROOT_DIR}"

pushd deps

pushd JavascriptSubtitlesOctopus
docker build -t radio/javascriptsubtitlesoctopus .
docker run -it --rm -v "$(pwd)"/dist/js:/code/dist/js radio/javascriptsubtitlesoctopus:latest

rm -rvf ../../static/js/modules/subtitles/*
cp -rvf dist/js/* ../../static/js/modules/subtitles/
popd

popd

./res/compress.sh ./static/js/modules/subtitles