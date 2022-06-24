#!/usr/bin/env bash

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

pushd "${ROOT_DIR}"

pushd deps

pushd JavascriptSubtitlesOctopus
./run-docker-build.sh make clean
./run-docker-build.sh

rm -rvf ../../static/js/modules/subtitles/*
cp -rvf dist/js/* ../../static/js/modules/subtitles/
popd

popd