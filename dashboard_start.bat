@echo off
chcp 65001 > nul
set ROOT=C:\Users\aaa\coding\dashboard

echo [1/2] Flask 백엔드 시작 (port 5000)...
start "Dashboard Backend" cmd /k "cd /d %ROOT% && C:\Python314\python.exe app.py"

timeout /t 2 /nobreak > nul

echo [2/2] 프론트엔드 시작 (port 5188)...
start "Dashboard Frontend" cmd /k "cd /d %ROOT%\frontend && npm run preview -- --port 5188 --host"

echo.
echo 백엔드: http://localhost:5000
echo 프론트: http://localhost:5188
