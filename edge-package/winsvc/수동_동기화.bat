@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem ============================================================
rem  수동 동기화 (지금 즉시 중앙과 1회 동기화)
rem  평소에는 자동 주기로 동기화되며, 급할 때만 사용하세요.
rem ============================================================

set "PORT=30001"
for /f "usebackq tokens=1,* delims==" %%A in ("config.env") do if /i "%%A"=="PORT" set "PORT=%%B"

echo 수동 동기화 요청 중 ... (업로드 → 다운로드)
echo.
curl -s -X POST "http://localhost:!PORT!/api/scheduler/sync?trigger=manual"
echo.
echo.
echo (결과 success/uploaded/downloaded/message 확인. 서버가 꺼져 있으면 응답이 없습니다.)
pause
