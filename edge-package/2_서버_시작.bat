@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

rem ============================================================
rem  선박 인트라 PMS 서버 시작
rem  config.env 의 설정값을 읽어 도커로 앱을 실행합니다.
rem ============================================================

rem --- 기본값 (config.env 에 없으면 사용) ---
set "PORT=30001"
set "DB_HOST=host.docker.internal"
set "DB_PORT=5432"
set "DB_NAME=toadsdocument"
set "DB_USER=postgres"
set "SYNC_INTERVAL_MIN=10"
set "VESSEL="
set "REMOTE_SITE_URL="
set "NODE_TOKEN="
set "DB_PASS="

rem --- config.env 읽기 (지연확장 OFF: 비밀번호의 ! ^ & 보존) ---
rem     ※ 제약: 비밀번호에 % 또는 " 가 들어가면 배치에서 안전하게 다룰 수 없습니다.
rem        DB_PASS 는 docker 에 환경변수 전달(-e DB_PASS)만 하며 명령줄에서 확장하지 않습니다.
for /f "usebackq tokens=1,* delims==" %%A in ("config.env") do (
  if /i "%%A"=="VESSEL"            set "VESSEL=%%B"
  if /i "%%A"=="REMOTE_SITE_URL"   set "REMOTE_SITE_URL=%%B"
  if /i "%%A"=="NODE_TOKEN"        set "NODE_TOKEN=%%B"
  if /i "%%A"=="DB_PASS"           set "DB_PASS=%%B"
  if /i "%%A"=="PORT"              set "PORT=%%B"
  if /i "%%A"=="DB_HOST"           set "DB_HOST=%%B"
  if /i "%%A"=="DB_PORT"           set "DB_PORT=%%B"
  if /i "%%A"=="DB_NAME"           set "DB_NAME=%%B"
  if /i "%%A"=="DB_USER"           set "DB_USER=%%B"
  if /i "%%A"=="SYNC_INTERVAL_MIN" set "SYNC_INTERVAL_MIN=%%B"
)

rem --- 필수값이 예시 그대로면 중단 (지연확장 OFF 상태에서 검사 → 비밀번호 ! 안전) ---
if not defined VESSEL        goto :needcfg
if "%VESSEL%"=="여기에_선박코드"  goto :needcfg
if not defined NODE_TOKEN    goto :needcfg
if "%NODE_TOKEN%"=="여기에_토큰"  goto :needcfg
if not defined DB_PASS       goto :needcfg
if "%DB_PASS%"=="여기에_비밀번호" goto :needcfg
goto :cfgok
:needcfg
echo.
echo [오류] config.env 의 필수값(선박코드 / 노드토큰 / DB 비밀번호)이 아직 채워지지 않았습니다.
echo        config.env 를 메모장으로 열어 ①③④ 를 입력한 뒤 다시 실행하세요.
pause & exit /b 1
:cfgok

rem --- 동기화 주기(분) → 밀리초 (숫자만, 안전) ---
set "SYNC_INTERVAL_MS="
set /a SYNC_INTERVAL_MS=%SYNC_INTERVAL_MIN%*60000 >nul 2>nul
if not defined SYNC_INTERVAL_MS set "SYNC_INTERVAL_MS=600000"
if "%SYNC_INTERVAL_MS%"=="0" set "SYNC_INTERVAL_MS=600000"

rem --- 이후 로직은 지연확장 ON ---
setlocal enabledelayedexpansion

echo [설정] 선박코드=!VESSEL!  중앙=!REMOTE_SITE_URL!  포트=!PORT!
echo [설정] DB=!DB_NAME!@!DB_HOST!:!DB_PORT! (user=!DB_USER!)  동기화주기=!SYNC_INTERVAL_MIN!분
echo.

rem --- 기존 컨테이너 정리 후 시작 ---
rem     DB_PASS 는 값 없이 -e DB_PASS 로 전달 → 현재 환경변수 값이 그대로 전달됨
rem     (명령줄에 비밀번호를 쓰지 않아 ! ^ & 등 특수문자에 안전)
docker rm -f pms-edge >nul 2>nul
docker run -d --name pms-edge -p !PORT!:3000 --restart unless-stopped ^
  -e PORT=3000 -e NODE_ENV=production -e NODE_ROLE=edge -e SYNC_WATCHER=on ^
  -e SYNC_INTERVAL_MS=!SYNC_INTERVAL_MS! ^
  -e VESSEL=!VESSEL! -e REMOTE_SITE_URL=!REMOTE_SITE_URL! -e NODE_TOKEN=!NODE_TOKEN! ^
  -e DB_HOST=!DB_HOST! -e DB_PORT=!DB_PORT! -e DB_NAME=!DB_NAME! ^
  -e DB_USER=!DB_USER! -e DB_PASS -e DB_SSL=false ^
  pms-edge:latest

if errorlevel 1 (
  echo.
  echo [오류] 서버 시작 실패. Docker 가 켜져 있는지, 이미지가 있는지 확인하세요.
  echo        이미지 준비: 0_이미지_불러오기.bat 를 먼저 실행.
  pause & exit /b 1
)

echo.
echo 서버 기동 대기 중... (몇 초)
timeout /t 5 /nobreak >nul

echo.
echo ============================================================
echo  서버 시작됨.
echo  - 이 PC:      http://localhost:!PORT!
echo  - 다른 선내 PC: http://(이 PC의 IP):!PORT!
echo  인터넷 연결 시 자동으로 배 데이터를 받아옵니다.
echo ============================================================
echo.
echo === 최근 로그 (15줄) — [watcher] started / 동기화 결과 확인 ===
docker logs --tail 15 pms-edge
echo.
echo (상태/로그: 4_상태_확인.bat  /  수동 동기화: 5_수동_동기화.bat  /  중지: 3_서버_중지.bat)
pause
