#!/bin/bash
# 바이오 카트 서버 성능 측정 (맥) — 더블클릭해서 실행
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "  [!] Node.js가 설치되어 있지 않아요. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요."
  read -r -p "  엔터를 누르면 닫혀요." _; exit 1
fi
echo "측정에 1~2분 걸려요. 다른 프로그램은 잠시 닫아 주세요."
node server/bench-kart.js
read -r -p "엔터를 누르면 닫혀요." _
