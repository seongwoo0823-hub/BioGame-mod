@echo off
chcp 65001 >nul
title 바이오 카트 서버 성능 측정
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js가 설치되어 있지 않아요. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
  pause
  exit /b
)
echo 측정에 1~2분 걸려요. 다른 프로그램은 잠시 닫아 주세요.
node server\bench-kart.js
echo.
pause
