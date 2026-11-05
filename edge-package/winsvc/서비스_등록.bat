@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem ============================================================
rem  ToadsPMS 를 Windows 서비스로 등록 (NSSM 사용, 관리자 권한 필요)
rem  document 프로그램과 동일한 방식. 서비스로 등록하면 PC 부팅 시 자동 실행.
rem ============================================================

rem --- 관리자 권한 확인 ---
net session >nul 2>&1
if errorlevel 1 (
  echo [오류] 관리자 권한이 필요합니다.
  echo        이 파일에서 마우스 오른쪽 클릭 ^-^> "관리자 권한으로 실행" 하세요.
  pause & exit /b 1
)

rem --- 폴더 경로(끝 백슬래시 제거) ---
set "FOLDER=%~dp0"
if "!FOLDER:~-1!"=="\" set "FOLDER=!FOLDER:~0,-1!"
if not exist "!FOLDER!\logs" mkdir "!FOLDER!\logs"

rem --- ToadsPMS.exe 확인 ---
if not exist "!FOLDER!\ToadsPMS.exe" (
  echo [오류] ToadsPMS.exe 가 이 폴더에 없습니다. 패키지 구성을 확인하세요.
  pause & exit /b 1
)

rem --- nssm 찾기 (이 폴더 우선, 없으면 PATH) ---
set "NSSM="
if exist "%~dp0nssm.exe" set "NSSM=%~dp0nssm.exe"
if not defined NSSM where nssm >nul 2>nul && set "NSSM=nssm"
if not defined NSSM (
  echo [오류] nssm.exe 를 찾을 수 없습니다.
  echo        document 프로그램에서 쓰던 nssm.exe 를 이 폴더에 복사한 뒤 다시 실행하세요.
  pause & exit /b 1
)

rem --- 이미 설치되어 있으면 변경하지 않음 ---
sc query ToadsPMS >nul 2>nul
if not errorlevel 1 (
  echo [알림] ToadsPMS 서비스가 이미 설치되어 있습니다. 변경하지 않고 종료합니다.
  echo        상태 확인: 상태_확인.bat   /   제거: 서비스_제거.bat
  pause & exit /b 0
)

echo 서비스 등록 중 ...
"!NSSM!" install ToadsPMS "!FOLDER!\ToadsPMS.exe"
"!NSSM!" set ToadsPMS AppDirectory "!FOLDER!"
"!NSSM!" set ToadsPMS DisplayName "Toads PMS"
"!NSSM!" set ToadsPMS Description "선박 인트라 PMS (Toads) - 로컬 엣지 서버"
"!NSSM!" set ToadsPMS Start SERVICE_AUTO_START
"!NSSM!" set ToadsPMS AppExit Default Restart
"!NSSM!" set ToadsPMS AppRestartDelay 5000
"!NSSM!" set ToadsPMS AppStdout "!FOLDER!\logs\service.log"
"!NSSM!" set ToadsPMS AppStderr "!FOLDER!\logs\service.log"
"!NSSM!" set ToadsPMS AppRotateFiles 1
"!NSSM!" set ToadsPMS AppRotateBytes 10485760

echo.
echo 서비스 시작 ...
"!NSSM!" start ToadsPMS

echo.
echo === 현재 상태 ===
sc query ToadsPMS
echo.
echo 완료. 브라우저에서  http://localhost:(config.env 의 PORT)  접속.
pause
