@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem --- config.env 에서 PORT 읽기 ---
set "PORT=30001"
for /f "usebackq tokens=1,* delims==" %%A in ("config.env") do (
  if /i "%%A"=="PORT" set "PORT=%%B"
)

echo === 서버 상태 ===
docker ps --filter name=pms-edge --format "{{.Names}}  {{.Status}}  {{.Ports}}"
echo.

echo === 동기화 상태 (/api/scheduler/sync) ===
rem curl 은 Windows 10+ 에 기본 포함
curl -s http://localhost:%PORT%/api/scheduler/sync
echo.
echo   (edge/running/last/lastUploadAt/lastDownloadAt 확인)
echo.

echo === 최근 로그 (30줄) ===
docker logs --tail 30 pms-edge
echo.
pause
