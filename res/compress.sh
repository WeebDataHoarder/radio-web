#!/bin/bash

shopt -s extglob

pushd "${1}" || exit

for f in *.@(js|mjs|data|wasm|mem|css|map|svg|ttf|woff|woff2); do
  echo "compressing $f"
  gzip --best --stdout --keep "$f" > "$f.gz"
  brotli --best --stdout --keep --no-copy-stat "$f" > "$f.br"
done