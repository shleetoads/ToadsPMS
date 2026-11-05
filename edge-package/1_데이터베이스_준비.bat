@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

rem ============================================================
rem  데이터베이스 준비 (최초 1회) — 완전히 새 PC(빈 DB) 용
rem  빈 데이터베이스 + 표 구조 전체를 만듭니다. (데이터는 서버가 자동 수신)
rem  ※ 이미 document 프로그램 DB 가 있는 선박은 이 배치 대신
rem    1B_기존DB에_PMS테이블_추가.bat 를 쓰세요.
rem ============================================================

rem --- 기본값 + config.env 읽기 (지연확장 OFF: 비밀번호의 ! ^ & 보존) ---
rem     ※ 제약: 비밀번호에 % 또는 " 가 들어가면 배치에서 안전하게 다룰 수 없습니다.
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

echo [1/2] 데이터베이스 생성...
"!PSQL!" -h 127.0.0.1 -p !DB_PORT! -U !DB_USER! -d postgres -c "CREATE DATABASE !DB_NAME!;" 2>nul

echo [2/2] 표 구조 적용...
for %%F in (000_base_schema 011_sync_change_seq 012_soft_delete 013_sync_state) do (
  "!PSQL!" -h 127.0.0.1 -p !DB_PORT! -U !DB_USER! -d !DB_NAME! -v ON_ERROR_STOP=1 -q -f "sql\%%F.sql"
  if errorlevel 1 (
    echo.
    echo [오류] %%F 적용 실패. PostgreSQL 이 켜져 있는지, 비밀번호가 맞는지 확인하세요.
    pause & exit /b 1
  )
)

echo.
echo ============================================================
echo  완료 (준비됨)
echo  다음: config.env 를 채운 뒤  2_서버_시작.bat  실행
echo ============================================================
pause
