@echo off
chcp 65001 > nul
setlocal
REM 서버 재시작 + 실적 엑셀 다시 읽기 + 반영 결과 확인을 한 번에 — Python 코드를 고친 뒤(예: 2027 계획 뷰 적용) 더블클릭.
REM 재시작 부분은 dashboard_start.bat과 같음(python dashboard_manager.py --start). ⚠️ dashboard_manager는 --start 외 인자를 주면 토글/--status 동작이 되니 다른 인자 금지.
REM 이 bat이 있는 폴더 기준 — PC마다 clone 위치가 달라도 동작
set "ROOT=%~dp0"
REM 파이썬 찾기 — .env의 PYTHON_EXE → C:\Python314 → PATH의 python (PC마다 설치 경로가 달라서)
set PYTHON=
if exist "%ROOT%.env" for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT%.env") do if /i "%%A"=="PYTHON_EXE" set "PYTHON=%%B"
if not defined PYTHON if exist "C:\Python314\python.exe" set "PYTHON=C:\Python314\python.exe"
if not defined PYTHON set "PYTHON=python"
set PYTHONIOENCODING=utf-8

cd /d "%ROOT%"

echo [1/3] 서버 재시작...
"%PYTHON%" dashboard_manager.py --start
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] 서버 기동 실패 — 새로 열린 백엔드/프론트 콘솔의 로그를 확인하세요
    pause
    exit /b 1
)

echo.
echo [2/3] 실적 엑셀 다시 읽기 (실적 뷰 + 2027 계획 뷰, 몇 초 걸릴 수 있음)...
curl -s --max-time 180 -X POST http://localhost:5000/api/performance/reload
echo.

echo.
echo [3/3] 반영 결과 (data\perf_update_status.json)
"%PYTHON%" "%ROOT%scripts\perf_status.py"
set RESULT=%ERRORLEVEL%

echo.
echo 프론트: http://localhost:5188
if %RESULT% NEQ 0 echo [주의] 위에 '실패' 표시가 있으면 화면은 직전 정상 파일로 보입니다 — 이유를 확인하세요
pause
endlocal
