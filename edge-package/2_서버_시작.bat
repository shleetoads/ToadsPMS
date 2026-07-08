@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem ============================================================
rem  선박 인트라 PMS 서버 시작
rem  config.env 의 설정값을 읽어 도커로 앱을 실행합니다.
rem ============================================================

rem --- config.env 읽기 ---
for /f "usebackq tokens=1,* delims==" %%A in ("config.env") do (
  set "K=%%A"
  set "V=%%B"
  if /i "!K!"=="VESSEL"          set "VESSEL=!V!"
  if /i "!K!"=="REMOTE_SITE_URL" set "REMOTE_SITE_URL=!V!"
  if /i "!K!"=="NODE_TOKEN"      set "NODE_TOKEN=!V!"
  if /i "!K!"=="DB_PASS"         set "DB_PASS=!V!"
  if /i "!K!"=="PORT"            set "PORT=!V!"
)
if not defined PORT set "PORT=30001"

echo [설정] 선박코드=!VESSEL!  중앙=!REMOTE_SITE_URL!  포트=!PORT!
echo.

rem --- 기존 컨테이너 정리 후 시작 ---
docker rm -f pms-edge >nul 2>nul
docker run -d --name pms-edge -p !PORT!:3000 --restart unless-stopped ^
  -e PORT=3000 -e NODE_ENV=production -e NODE_ROLE=edge -e SYNC_WATCHER=on ^
  -e VESSEL=!VESSEL! -e REMOTE_SITE_URL=!REMOTE_SITE_URL! -e NODE_TOKEN=!NODE_TOKEN! ^
  -e DB_HOST=host.docker.internal -e DB_PORT=5432 -e DB_NAME=toadsdocument ^
  -e DB_USER=postgres -e DB_PASS=!DB_PASS! -e DB_SSL=false ^
  pms-edge:latest

if errorlevel 1 (
  echo.
  echo [오류] 서버 시작 실패. Docker 가 켜져 있는지, 이미지가 있는지 확인하세요.
  echo        이미지 준비: 0_이미지_불러오기.bat 를 먼저 실행.
  pause & exit /b 1
)

echo.
echo ============================================================
echo  서버 시작됨.
echo  - 이 PC:      http://localhost:!PORT!
echo  - 다른 선내 PC: http://(이 PC의 IP):!PORT!
echo  인터넷 연결 시 1~3분 내 자동으로 배 데이터를 받아옵니다.
echo ============================================================
echo.
echo (로그 보기: 4_상태_확인.bat  /  중지: 3_서버_중지.bat)
pause
