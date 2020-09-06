#!/usr/bin/env bash

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

pushd "${ROOT_DIR}"

git submodule update --init --recursive

pushd deps

pushd aurora.js
npm install
make clean
make browser
sed -i "s#${ROOT_DIR}##g" build/aurora.js.map
sed -i 's!\(# sourceMappingURL=\)!\1/js/player/!g' build/aurora.js
cp -vf build/aurora.js* ../../js/player/
popd

pushd aac.js
npm install
make clean
make browser
sed -i "s#${ROOT_DIR}##g" build/aac.js.map
sed -i 's!\(# sourceMappingURL=\)!\1/js/player/codecs/!g' build/aac.js
cp -vf build/aac.js* ../../js/player/codecs/
popd

pushd flac.js
npm install
make clean
make browser
sed -i "s#${ROOT_DIR}##g" build/flac.js.map
sed -i 's!\(# sourceMappingURL=\)!\1/js/player/codecs/!g' build/flac.js
cp -vf build/flac.js* ../../js/player/codecs/
popd

pushd alac.js
npm install
make clean
make browser
sed -i "s#${ROOT_DIR}##g" build/alac.js.map
sed -i 's!\(# sourceMappingURL=\)!\1/js/player/codecs/!g' build/alac.js
cp -vf build/alac.js* ../../js/player/codecs/
popd

pushd mp3.js
npm install
make clean
make browser
sed -i "s#${ROOT_DIR}##g" build/mp3.js.map
sed -i 's!\(# sourceMappingURL=\)!\1/js/player/codecs/!g' build/mp3.js
cp -vf build/mp3.js* ../../js/player/codecs/
popd

pushd ogg.js
npm install
make clean
make libogg
make browser
cp -vf build/ogg.js* ../../js/player/codecs/
popd

pushd opus.js
npm install
make clean
make libopus
make browser
cp -vf build/opus.js* ../../js/player/codecs/
popd

pushd vorbis.js
npm install
make clean
make libvorbis
make browser
cp -vf build/vorbis.js* ../../js/player/codecs/
popd

pushd trueaudio.js
npm init -y
npm install --save-dev coffeeify coffeescript browserify
./node_modules/.bin/browserify -t coffeeify --extension=".coffee" tta.coffee > ../../js/player/codecs/tta.js
popd



pushd JavascriptSubtitlesOctopus
docker build -t radio/javascriptsubtitlesoctopus .
docker run -it --rm -v "$(pwd)":/code radio/javascriptsubtitlesoctopus:latest

rm -rvf ../../js/subtitles/*
cp -rvf dist/js/* ../../js/subtitles/
popd