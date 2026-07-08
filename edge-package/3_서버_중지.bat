@echo off
chcp 65001 >nul
echo 서버를 중지합니다...
docker rm -f pms-edge
echo 중지됨. 다시 켜려면 2_서버_시작.bat 실행.
pause
