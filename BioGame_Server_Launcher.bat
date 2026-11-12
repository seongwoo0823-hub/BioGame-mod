@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title BIO ARCADE Node.js 서버 컨트롤러

:: 현재 스크립트 위치 기준 폴더 탐색 (루트 또는 server 폴더 모두 호환)
set "SCRIPT_DIR=%~dp0"
if exist "%SCRIPT_DIR%server\server.js" (
    set "SERVER_DIR=%SCRIPT_DIR%server"
    set "ROOT_DIR=%SCRIPT_DIR%"
) else if exist "%SCRIPT_DIR%server.js" (
    set "SERVER_DIR=%SCRIPT_DIR%"
    set "ROOT_DIR=%SCRIPT_DIR%.."
) else (
    echo [오류] server.js 파일을 찾을 수 없습니다.
    echo 이 배치 파일을 BioGame-mod 폴더 또는 BioGame-mod\server 폴더 안에 넣어주세요.
    pause
    exit /b 1
)

:: 바탕화면 바로가기 아이콘이 아직 없으면 최초 1회 자동 생성
for /f "delims=" %%D in ('powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"') do set "DESKTOP_DIR=%%D"
set "SHORTCUT_PATH=%DESKTOP_DIR%\BIO ARCADE 서버 ON-OFF.lnk"

if not exist "%SHORTCUT_PATH%" (
    call :CREATE_SHORTCUT
)

:MAIN_CHECK
:: 현재 8080 포트에서 서버가 돌아가고 있는지 확인
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:8080/api/status' -TimeoutSec 1; exit 0 } catch { exit 1 }"
if %errorlevel% equ 0 (
    goto :SERVER_RUNNING_MENU
) else (
    goto :START_SERVER_FLOW
)

:START_SERVER_FLOW
cls
echo ============================================================
echo   [BIO ARCADE] 로컬 Node.js 서버를 시작합니다...
echo ============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [오류] Node.js가 설치되어 있지 않습니다!
    echo https://nodejs.org 에서 Node.js LTS 버전을 먼저 설치해주세요.
    pause
    exit /b 1
)

cd /d "%SERVER_DIR%"
if not exist "%SERVER_DIR%\node_modules\ws" (
    echo [초기 설정] 필요한 패키지^(ws^)를 설치하고 있습니다...
    call npm install
    echo.
)

:: 백그라운드 창 숨김 상태로 Node 서버 실행
powershell -NoProfile -Command "Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory '%SERVER_DIR%' -WindowStyle Hidden"
timeout /t 1 /nobreak >nul

powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:8080/api/status' -TimeoutSec 2; exit 0 } catch { exit 1 }"
if %errorlevel% equ 0 (
    cls
    echo ============================================================
    echo   [가동 완료] BIO ARCADE Node.js 서버가 켜졌습니다! ^(🟢 ON^)
    echo ============================================================
    echo.
    powershell -NoProfile -Command "$r = Invoke-RestMethod -Uri 'http://127.0.0.1:8080/api/status'; Write-Host ('  * 내 PC 게임 접속 주소 : http://localhost:' + $r.port) -ForegroundColor Green; if ($r.lanIps.Count -gt 0) { Write-Host ('  * 같은 와이파이 친구 접속 : http://' + $r.lanIps[0] + ':' + $r.port) -ForegroundColor Cyan }"
    echo.
    echo   - 이제 브라우저로 게임을 열면 자동으로 로컬 서버^(핑 1ms^)에 연결됩니다.
    echo   - 서버를 끄려면 바탕화면의 [BIO ARCADE 서버 ON-OFF] 아이콘을 다시 더블클릭하세요.
    echo ============================================================
    echo.
    choice /C YN /T 5 /D Y /M "지금 바로 브라우저에서 BIO ARCADE 게임을 여시겠습니까? (5초 후 자동 열림)"
    if !errorlevel! equ 1 (
        start "" "http://localhost:8080"
    )
    exit /b 0
) else (
    echo [오류] 서버 시작에 실패했습니다. 포트 8080이 사용 중인지 확인해주세요.
    pause
    exit /b 1
)

:SERVER_RUNNING_MENU
cls
echo ============================================================
echo   [현재 상태] BIO ARCADE Node.js 서버가 실행 중입니다! ^(🟢 ON^)
echo ============================================================
echo.
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:8080/api/status'; Write-Host ('  * 현재 접속 피어 수 : ' + $r.peers + '명 / 활성 연결 : ' + $r.links + '개 / 가동 시간 : ' + $r.uptimeSec + '초'); Write-Host ('  * 내 PC 접속 주소   : http://localhost:' + $r.port) -ForegroundColor Green; if ($r.lanIps.Count -gt 0) { Write-Host ('  * LAN 친구 접속 주소: http://' + $r.lanIps[0] + ':' + $r.port) -ForegroundColor Cyan } } catch {}"
echo.
echo   [1] 서버 즉시 끄기 ^(🔴 OFF^)
echo   [2] 서버 재시작 ^(🔄 Restart^)
echo   [3] 브라우저로 게임 열기 ^(🎮 Play^)
echo   [4] 바탕화면 바로가기 아이콘 다시 만들기
echo   [5] 닫기 ^(서버 켜둔 채로 창만 닫기^)
echo ============================================================
choice /C 12345 /N /M "원하시는 번호를 누르세요 (1~5): "
set "SEL=%errorlevel%"

if "%SEL%"=="1" (
    echo.
    echo 서버를 안전하게 종료하고 있습니다...
    powershell -NoProfile -Command "try { Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8080/api/stop' -TimeoutSec 2 | Out-Null } catch {}"
    timeout /t 1 /nobreak >nul
    echo [완료] 서버가 꺼졌습니다. ^(🔴 OFF^)
    timeout /t 2 >nul
    exit /b 0
)
if "%SEL%"=="2" (
    echo.
    echo 서버를 재시작합니다...
    powershell -NoProfile -Command "try { Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8080/api/stop' -TimeoutSec 2 | Out-Null } catch {}"
    timeout /t 1 /nobreak >nul
    goto :START_SERVER_FLOW
)
if "%SEL%"=="3" (
    start "" "http://localhost:8080"
    exit /b 0
)
if "%SEL%"=="4" (
    call :CREATE_SHORTCUT
    pause
    goto :SERVER_RUNNING_MENU
)
exit /b 0

:CREATE_SHORTCUT
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%~f0'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.IconLocation = 'shell32.dll,13'; $s.Description = 'BIO ARCADE Node.js 서버 켜기/끄기 컨트롤러'; $s.Save()"
if exist "%SHORTCUT_PATH%" (
    echo [안내] 바탕화면에 [BIO ARCADE 서버 ON-OFF] 아이콘이 생성되었습니다!
)
exit /b 0
