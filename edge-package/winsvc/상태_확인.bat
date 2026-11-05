@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem --- config.env 에서 PORT 읽기 ---
set "PORT=30001"
for /f "usebackq tokens=1,* delims==" %%A in ("config.env") do if /i "%%A"=="PORT" set "PORT=%%B"

echo === 서비스 상태 ===
sc query ToadsPMS 2>nul
if errorlevel 1 echo (ToadsPMS 서비스가 설치되어 있지 않습니다. 서비스_등록.bat 참조 또는 ToadsPMS.exe 직접 실행 중일 수 있음)
echo.

echo === 동기화 상태 (/api/scheduler/sync) ===
curl -s http://localhost:!PORT!/api/scheduler/sync
echo.
echo   (edge/running/last/lastUploadAt/lastDownloadAt 확인)
echo.

echo === 오늘 로그 마지막 30줄 ===
powershell -NoProfile -Command "$f = Get-ChildItem -Path 'logs\pms-*.log' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime | Select-Object -Last 1; if ($f) { Get-Content -LiteralPath $f.FullName -Tail 30 -Encoding UTF8 } else { Write-Host '(로그 파일이 아직 없습니다)' }"
echo.
pause
