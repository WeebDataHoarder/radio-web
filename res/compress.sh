#!/bin/bash

shopt -s extglob

pushd "${1}" || exit

for f in *.@(js|mjs|data|wasm|mem|css|map|svg|ttf|woff|woff2); do
  echo "compressing $f"
  zopfli --gzip -c --verbose --i50 "$f" > "$f.gz"
  brotli --best --stdout --keep --no-copy-stat "$f" > "$f.br"
done