@echo off
chcp 65001 >nul
echo === 서버 상태 ===
docker ps --filter name=pms-edge --format "{{.Names}}  {{.Status}}  {{.Ports}}"
echo.
echo === 최근 로그 (30줄) ===
docker logs --tail 30 pms-edge
echo.
pause
