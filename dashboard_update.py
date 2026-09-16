"""
대시보드 PPT 데이터 업데이트
1. extract_financial_ppt.py 실행
2. extract_kpi_ppt.py 실행
3. Flask 캐시 갱신
"""
import subprocess
import sys
import urllib.request
from pathlib import Path

# Windows 콘솔 UTF-8 출력
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT       = Path(__file__).parent
PYTHON     = sys.executable
API_RELOAD = "http://localhost:5000/api/reload"


def run(script_name):
    script = ROOT / "scripts" / script_name
    print(f"[실행] {script_name}")
    result = subprocess.run(
        # CLI 인수를 안 넘겨야 스크립트 자체의 .env(EXTRACT_BASE_DIR/EXTRACT_KPI_ROOT_DIR)
        # 폴백 로직이 그대로 적용됨 — 여기서 폴더를 하드코딩하면 .env를 바꿔도 무시됨(2026-09-16 버그)
        [PYTHON, str(script)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=1800,  # 평소엔 1~30개라 5분(300s)로 충분했는데, 대량 재수정 시(예: 211개) 부족했음
    )
    if result.stdout:
        print(result.stdout[-500:].encode('utf-8','replace').decode('utf-8','replace'))
    if result.stderr:
        print(result.stderr[-300:].encode('utf-8','replace').decode('utf-8','replace'))
    if result.returncode != 0:
        print(f"[ERROR] {script_name} 실패 (exit {result.returncode})")
        sys.exit(1)
    print(f"[OK] {script_name} 완료")


def reload_api():
    try:
        req = urllib.request.Request(API_RELOAD, method="POST")
        urllib.request.urlopen(req, timeout=10)
        print("[OK] Flask 캐시 갱신 완료")
    except Exception as e:
        print(f"[WARN] API 갱신 실패 (서버 꺼져있을 수 있음): {e}")


if __name__ == "__main__":
    run("extract_financial_ppt.py")
    run("extract_kpi_ppt.py")
    reload_api()
    print("[완료] 대시보드 업데이트 성공")
