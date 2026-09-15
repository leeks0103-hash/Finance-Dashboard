@echo off
chcp 65001 > nul
set ROOT=C:\Users\aaa\coding\dashboard

cd /d %ROOT%
C:\Python314\python.exe dashboard_manager.py --start

echo.
echo 백엔드: http://localhost:5000
echo 프론트: http://localhost:5188
pause
