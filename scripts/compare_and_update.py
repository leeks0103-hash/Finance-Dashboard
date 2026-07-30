"""
compare_and_update.py
─────────────────────
사용법:
    python scripts/compare_and_update.py <기존폴더> <새폴더>

예시:
    python scripts/compare_and_update.py \
        "C:\\Users\\aaa\\Desktop\\기술교육실_프로젝트 보고서 수집" \
        "C:\\Users\\aaa\\Desktop\\기술교육실_프로젝트 보고서 수집 NEW"

흐름:
    1. 두 폴더의 PPT 파일 비교
    2. 변경(신규·수정)이 있으면 새 폴더 기준으로 재무 데이터 추출
    3. 추출 완료 후 API 캐시 자동 갱신 (/api/reload)
    4. 비교 리포트 Excel 저장 (data/compare_report.xlsx)
"""

import sys
import io
import os
import importlib
import subprocess
import requests
import logging
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ── 경로 설정 ───────────────────────────────────────────────────
_SCRIPT_DIR = Path(__file__).resolve().parent
_ROOT_DIR   = _SCRIPT_DIR.parent
_DATA_DIR   = _ROOT_DIR / "data"

REPORT_EXCEL = str(_DATA_DIR / "compare_report.xlsx")  # 기본값, 잠금 시 타임스탬프 버전으로 대체
API_RELOAD   = "http://localhost:5000/api/reload"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ── 1. 인수 파싱 ────────────────────────────────────────────────
def parse_args():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    old_dir = sys.argv[1]
    new_dir = sys.argv[2]
    if not Path(old_dir).exists():
        log.error("기존 폴더 없음: %s", old_dir)
        sys.exit(1)
    if not Path(new_dir).exists():
        log.error("새 폴더 없음: %s", new_dir)
        sys.exit(1)
    return old_dir, new_dir


# ── 2. PPT 폴더 비교 ────────────────────────────────────────────
def compare(old_dir: str, new_dir: str) -> dict:
    from datetime import datetime
    sys.path.insert(0, str(_SCRIPT_DIR))
    fc = importlib.import_module("file_compare")
    fc.NAS_PATH   = old_dir
    fc.LOCAL_PATH = new_dir
    result = fc.compare_folders(old_dir, new_dir)

    # 파일 잠금 시 타임스탬프 버전으로 저장
    report_path = REPORT_EXCEL
    try:
        fc.save_to_excel(result, report_path)
    except PermissionError:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_path = str(_DATA_DIR / f"compare_report_{ts}.xlsx")
        fc.save_to_excel(result, report_path)
        log.warning("기존 리포트 파일이 열려 있어 새 파일로 저장: %s", report_path)

    log.info("리포트 저장: %s", report_path)
    return result


# ── 3. 변경 여부 판단 ───────────────────────────────────────────
def has_changes(result: dict) -> bool:
    return bool(result["only_in_local"] or result["modified"])


# ── 4. 데이터 추출 (재무 + KPI) ────────────────────────────────
def _run_script(script_name: str, env: dict):
    result = subprocess.run(
        [sys.executable, str(_SCRIPT_DIR / script_name)],
        env=env,
        capture_output=False,
    )
    if result.returncode != 0:
        log.error("%s 실패 (returncode=%d)", script_name, result.returncode)
        sys.exit(1)


def extract(new_dir: str):
    env = os.environ.copy()
    env["EXTRACT_BASE_DIR"]    = new_dir   # 재무 추출 경로
    env["EXTRACT_KPI_ROOT_DIR"] = new_dir  # KPI 추출 경로

    log.info("재무 데이터 추출 시작: %s", new_dir)
    _run_script("extract_financial_ppt.py", env)
    log.info("재무 추출 완료")

    log.info("KPI 데이터 추출 시작")
    _run_script("extract_kpi_ppt.py", env)
    log.info("KPI 추출 완료")


# ── 5. API 캐시 갱신 (재무 + KPI) ──────────────────────────────
def reload_api():
    base = "http://localhost:5000/api"
    endpoints = [
        (f"{base}/reload",      "재무"),
        (f"{base}/kpi/reload",  "KPI"),
    ]
    for url, name in endpoints:
        try:
            r = requests.post(url, timeout=10)
            if r.status_code == 200 and r.json().get("ok"):
                log.info("%s 캐시 갱신 완료 (%d건)", name, r.json().get("count", 0))
            else:
                log.warning("%s reload 응답 이상: %s", name, r.text[:100])
        except requests.exceptions.ConnectionError:
            log.warning("Flask 서버 미연결 — 서버 재시작 후 갱신 필요")


# ── 메인 ────────────────────────────────────────────────────────
def main():
    old_dir, new_dir = parse_args()

    log.info("=" * 60)
    log.info("비교 시작")
    log.info("  기존: %s", old_dir)
    log.info("  신규: %s", new_dir)
    log.info("=" * 60)

    result = compare(old_dir, new_dir)

    identical    = result["identical"]
    only_new     = len(result["only_in_local"])
    only_old     = len(result["only_in_nas"])
    modified     = len(result["modified"])

    print()
    log.info("비교 결과")
    log.info("  동일      : %d개", identical)
    log.info("  신규에만  : %d개", only_new)
    log.info("  기존에만  : %d개", only_old)
    log.info("  수정됨    : %d개", modified)
    log.info("  리포트    : %s", REPORT_EXCEL)

    if not has_changes(result):
        log.info("변경 없음 — 추출 생략")
        return

    log.info("변경 감지 (신규 %d + 수정 %d) → 재추출 시작", only_new, modified)
    extract(new_dir)
    reload_api()
    log.info("완료")


if __name__ == "__main__":
    main()
