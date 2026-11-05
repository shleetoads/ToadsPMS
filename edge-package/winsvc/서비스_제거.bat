@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem ============================================================
rem  ToadsPMS 서비스 제거 (NSSM, 관리자 권한 필요)
rem ============================================================

net session >nul 2>&1
if errorlevel 1 (
  echo [오류] 관리자 권한이 필요합니다. 오른쪽 클릭 ^-^> "관리자 권한으로 실행".
  pause & exit /b 1
)

set "NSSM="
if exist "%~dp0nssm.exe" set "NSSM=%~dp0nssm.exe"
if not defined NSSM where nssm >nul 2>nul && set "NSSM=nssm"
if not defined NSSM (
  echo [오류] nssm.exe 를 찾을 수 없습니다. 이 폴더에 nssm.exe 를 두고 다시 실행하세요.
  pause & exit /b 1
)

sc query ToadsPMS >nul 2>nul
if errorlevel 1 (
  echo [알림] ToadsPMS 서비스가 설치되어 있지 않습니다.
  pause & exit /b 0
)

echo 서비스 중지 ...
"!NSSM!" stop ToadsPMS
echo 서비스 제거 ...
"!NSSM!" remove ToadsPMS confirm
echo 완료.
pause
