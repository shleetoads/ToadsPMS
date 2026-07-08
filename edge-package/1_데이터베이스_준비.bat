@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem ============================================================
rem  데이터베이스 준비 (최초 1회)
rem  빈 데이터베이스 + 표 구조를 만듭니다. (데이터는 서버가 자동 수신)
rem ============================================================

rem --- config.env 에서 DB 비밀번호 읽기 ---
for /f "usebackq tokens=1,* delims==" %%A in ("config.env") do (
  if /i "%%A"=="DB_PASS" set "PGPASSWORD=%%B"
)
if not defined PGPASSWORD (
  set /p PGPASSWORD=DB 비밀번호를 입력하세요:
)

rem --- psql 찾기 (PATH 또는 표준 설치경로) ---
set "PSQL=psql"
where psql >nul 2>nul
if errorlevel 1 (
  for /d %%D in ("C:\Program Files\PostgreSQL\*") do if exist "%%D\bin\psql.exe" set "PSQL=%%D\bin\psql.exe"
)

echo [1/2] 데이터베이스 생성...
"%PSQL%" -U postgres -d postgres -c "CREATE DATABASE toadsdocument;" 2>nul

echo [2/2] 표 구조 적용...
for %%F in (000_base_schema 011_sync_change_seq 012_soft_delete 013_sync_state) do (
  "%PSQL%" -U postgres -d toadsdocument -v ON_ERROR_STOP=1 -q -f "sql\%%F.sql"
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
