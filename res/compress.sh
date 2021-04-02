#!/bin/bash

shopt -s extglob

pushd "${1}" || exit

for f in *.@(js|mjs|data|wasm|mem|css|map|svg|ttf|woff|woff2); do
  if [[ ! -f "$f.gz" ]]; then
    echo "compressing $f -> $f.gz"
    zopfli --gzip -c --verbose --i50 "$f" > "$f.gz"
  fi

  if [[ ! -f "$f.br" ]]; then
    echo "compressing $f -> $f.br"
    brotli --best --stdout --keep --no-copy-stat "$f" > "$f.br"
  fi
done