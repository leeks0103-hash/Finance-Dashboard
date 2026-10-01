@echo off
chcp 65001 > nul
setlocal
REM 이 bat이 있는 폴더 기준 — PC마다 clone 위치가 달라도 동작(예전엔 C:\Users\aaa\... 고정이라 다른 PC에서 재시작이 안 됐음)
set "ROOT=%~dp0"
REM 파이썬 찾기 — .env의 PYTHON_EXE → C:\Python314 → PATH의 python (PC마다 설치 경로가 달라서)
set PYTHON=
if exist "%ROOT%.env" for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT%.env") do if /i "%%A"=="PYTHON_EXE" set "PYTHON=%%B"
if not defined PYTHON if exist "C:\Python314\python.exe" set "PYTHON=C:\Python314\python.exe"
if not defined PYTHON set "PYTHON=python"

cd /d "%ROOT%"
"%PYTHON%" dashboard_manager.py --start

echo.
echo 백엔드: http://localhost:5000
echo 프론트: http://localhost:5188
pause
endlocal
