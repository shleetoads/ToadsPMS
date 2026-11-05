@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

rem ============================================================
rem  기존 DB(document) 에 PMS 표 추가 (최초 1회)
rem  이미 document 프로그램 DB 가 있는 선박용.
rem  빈 DB 를 만들지 않고, 기존 DB 에 PMS 전용 표/함수만 추가합니다.
rem  (새 PC 처음 설치는 1_데이터베이스_준비.bat 를 쓰세요.)
rem ============================================================

rem --- config.env 읽기 (지연확장 OFF 상태에서 읽어 비밀번호의 ! ^ & 를 보존) ---
rem     ※ 제약: 비밀번호에 % 또는 " 가 들어가면 배치에서 안전하게 다룰 수 없습니다.
rem        그런 경우 아래 프롬프트에서 직접 입력하거나 PostgreSQL 비밀번호를 변경하세요.
set "DB_NAME=toadsdocument"
set "DB_USER=postgres"
set "DB_PORT=5432"
set "PGPASSWORD="
for /f "usebackq tokens=1,* delims==" %%A in ("config.env") do (
  if /i "%%A"=="DB_NAME" set "DB_NAME=%%B"
  if /i "%%A"=="DB_USER" set "DB_USER=%%B"
  if /i "%%A"=="DB_PORT" set "DB_PORT=%%B"
  if /i "%%A"=="DB_PASS" set "PGPASSWORD=%%B"
)
if "%PGPASSWORD%"=="여기에_비밀번호" set "PGPASSWORD="
if not defined PGPASSWORD set /p "PGPASSWORD=DB 비밀번호를 입력하세요: "
rem PGPASSWORD 는 환경변수로만 psql 에 전달하며, 명령줄에서 확장(!..! / %..%)하지 않습니다.

rem --- 이후 로직은 지연확장 ON ---
setlocal enabledelayedexpansion

rem --- psql 찾기 (PATH 또는 표준 설치경로; 경로에 공백 있음) ---
set "PSQL=psql"
where psql >nul 2>nul
if errorlevel 1 (
  for /d %%D in ("C:\Program Files\PostgreSQL\*") do if exist "%%D\bin\psql.exe" set "PSQL=%%D\bin\psql.exe"
)

echo [설정] DB=!DB_NAME!  사용자=!DB_USER!  포트=!DB_PORT!
echo.

rem --- 1) 대상 DB 접속 + vessel 표 확인 (document DB 가 맞는지) ---
rem     cmd /c 따옴표 함정을 피하려고 for /f 로 명령을 직접 실행하지 않고,
rem     psql 출력을 임시파일로 보낸 뒤 for /f 로 파일을 읽는다(후행 CR 자동 제거).
echo [1/2] 기존 document DB 확인...
set "CHKFILE=%TEMP%\pms_vesselchk_%RANDOM%%RANDOM%.txt"
"!PSQL!" -h 127.0.0.1 -p !DB_PORT! -U !DB_USER! -d !DB_NAME! -t -A -c "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='vessel';" > "!CHKFILE!" 2>nul
set "HASVESSEL="
if exist "!CHKFILE!" for /f "usebackq delims=" %%R in ("!CHKFILE!") do set "HASVESSEL=%%R"
if exist "!CHKFILE!" del "!CHKFILE!" >nul 2>nul
if not "!HASVESSEL!"=="1" (
  echo.
  echo [오류] DB "!DB_NAME!" 에 접속할 수 없거나, 그 안에 document 기본 표^(vessel^)가 없습니다.
  echo        - PostgreSQL 이 켜져 있는지, 비밀번호가 맞는지 확인하세요.
  echo        - 이 PC 가 document 프로그램 DB 를 가진 선박이 맞는지 확인하세요.
  echo        - 완전히 새 PC^(빈 DB^) 라면 이 배치 대신 1_데이터베이스_준비.bat 를 쓰세요.
  pause & exit /b 1
)

rem --- 2) PMS 전용 표/함수 추가 (멱등 — 두 번 실행해도 안전) ---
echo [2/2] PMS 표/함수 추가...
"!PSQL!" -h 127.0.0.1 -p !DB_PORT! -U !DB_USER! -d !DB_NAME! -v ON_ERROR_STOP=1 -f "sql\100_pms_on_document_db.sql"
if errorlevel 1 (
  echo.
  echo [오류] PMS 표 추가 실패. 위 메시지를 확인하세요.
  pause & exit /b 1
)

echo.
echo ============================================================
echo  완료 — 기존 DB 에 PMS 표가 추가되었습니다.
echo  다음: config.env 를 채운 뒤  2_서버_시작.bat  실행
echo ============================================================
pause
