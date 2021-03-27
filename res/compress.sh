#!/bin/bash

shopt -s extglob

pushd "${1}" || exit

for f in *.@(js|mjs|data|wasm|mem|css|map|svg|ttf|woff|woff2); do
  echo "compressing $f"
  if [[ "$f" == *data ]]; then
    #Use not so slow compression on the large binary files
    gzip --best --stdout --keep "$f" > "$f.gz"
  else
    zopfli --gzip -c --verbose --i50 "$f" > "$f.gz"
  fi
  brotli --best --stdout --keep --no-copy-stat "$f" > "$f.br"
done