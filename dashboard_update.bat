@echo off
chcp 65001 > nul
setlocal
REM 이 bat이 있는 폴더 기준 — PC마다 clone 위치가 달라도 동작
set "ROOT=%~dp0"
REM 파이썬 찾기 — .env의 PYTHON_EXE → C:\Python314 → PATH의 python (PC마다 설치 경로가 달라서)
set PYTHON=
if exist "%ROOT%.env" for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT%.env") do if /i "%%A"=="PYTHON_EXE" set "PYTHON=%%B"
if not defined PYTHON if exist "C:\Python314\python.exe" set "PYTHON=C:\Python314\python.exe"
if not defined PYTHON set "PYTHON=python"

REM PPT 원본 폴더는 스크립트가 paths.PPT_SOURCE_DIR(NAS)로 고정 — 폴더 인수를 넘겨도 무시됨(2026-09-30)
REM ⚠️ 이 배치는 서버를 재시작하지 않음 — 엑셀 캐시만 다시 읽음. Python 코드가 바뀌었으면 dashboard_start.bat
echo [1/3] 재무 데이터 추출...
"%PYTHON%" "%ROOT%scripts\extract_financial_ppt.py"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] 재무 추출 실패
    exit /b 1
)

echo [2/3] KPI 데이터 추출...
"%PYTHON%" "%ROOT%scripts\extract_kpi_ppt.py"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] KPI 추출 실패
    exit /b 1
)

echo [3/3] API 캐시 갱신...
curl -s -X POST http://localhost:5000/api/reload
echo.
echo [OK] 대시보드 업데이트 완료
endlocal & exit /b 0
