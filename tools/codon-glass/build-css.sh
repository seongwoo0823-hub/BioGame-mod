#!/bin/sh
# 사용법: npm i tailwindcss@3.4.17 을 한 뒤  sh tools/codon-glass/build-css.sh
D=$(dirname "$0")
npx tailwindcss@3.4.17 -c "$D/tailwind.config.js" -i "$D/input.css" -o "$D/../../games/codon-glass/tw.css" --minify
