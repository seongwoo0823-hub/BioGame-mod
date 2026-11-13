#!/bin/bash
# BIO ARCADE 교실 서버 켜기/끄기 (맥) — 더블클릭. 처음엔 오른쪽 클릭 → 열기
cd "$(dirname "$0")"
B=http://127.0.0.1:8080
ask(){ osascript -e "display dialog \"$1\" buttons {$2} default button 1 with title \"BIO ARCADE 교실 서버\"" -e 'button returned of result' 2>/dev/null; }
if curl -s -m 1.5 "$B/__status" >/dev/null; then
  r=$(ask "교실 서버가 켜져 있어요." '"서버 끄기","사이트 열기","취소"')
  if [ "$r" = "서버 끄기" ]; then curl -s -m 2 "$B/api/stop" >/dev/null; sleep 1; ask "서버를 껐어요." '"확인"' >/dev/null
  elif [ "$r" = "사이트 열기" ]; then open "$B/"; fi
  exit 0
fi
if ! command -v node >/dev/null 2>&1; then ask "Node.js가 설치되어 있지 않아요. LTS 버전을 설치한 뒤 다시 실행하세요." '"확인"' >/dev/null; open "https://nodejs.org/ko"; exit 1; fi
nohup node server/server.js > server/server.log 2>&1 &
for i in $(seq 1 40); do sleep 0.25; curl -s -m 0.5 "$B/__status" >/dev/null && break; done
urls=$(curl -s -m 2 "$B/__info" | grep -o 'http://[0-9.]*:[0-9]*' | sed 's#http://#   ▶ #' | sort -u)
open "$B/"
ask "서버를 켰어요!\n\n학생 접속 주소:\n$urls\n\n끌 때는 이 파일을 다시 실행하세요." '"확인"' >/dev/null
