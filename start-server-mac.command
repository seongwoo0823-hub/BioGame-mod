#!/bin/bash
# BIO ARCADE 교실 서버 (맥) — 더블클릭해서 실행. 처음에 "확인되지 않은 개발자" 경고가 뜨면
# 파일을 오른쪽 클릭 → 열기 를 한 번 눌러 주세요.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  [!] Node.js가 설치되어 있지 않아요. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요."
  open "https://nodejs.org/ko"
  read -n 1 -s -r -p "  아무 키나 누르면 닫혀요"
  exit 1
fi
node server/server.js
