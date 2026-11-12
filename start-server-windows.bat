@echo off
chcp 65001 >nul
title BIO ARCADE 교실 서버
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [!] Node.js가 설치되어 있지 않아요.
  echo      https://nodejs.org 에서 LTS 버전을 설치한 뒤 이 파일을 다시 더블클릭하세요.
  echo.
  start https://nodejs.org/ko
  pause
  exit /b 1
)
node server\server.js
echo.
echo  서버가 꺼졌어요. 아무 키나 누르면 창이 닫혀요.
pause >nul
