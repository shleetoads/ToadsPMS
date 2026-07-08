@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem ============================================================
rem  앱 이미지 불러오기 (최초 1회)
rem  본사에서 받은 pms-edge.tar 파일을 도커에 등록합니다.
rem ============================================================

if not exist "pms-edge.tar" (
  echo [오류] pms-edge.tar 파일이 이 폴더에 없습니다.
  echo        본사에서 받은 이미지 파일을 이 폴더에 넣어주세요.
  pause & exit /b 1
)

echo 이미지 불러오는 중... (수십 초 걸릴 수 있습니다)
docker load -i pms-edge.tar
if errorlevel 1 ( echo [오류] 불러오기 실패. Docker 가 켜져 있는지 확인하세요. & pause & exit /b 1 )

echo.
echo 완료. 다음: 1_데이터베이스_준비.bat
pause
