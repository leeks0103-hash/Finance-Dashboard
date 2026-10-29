"""실적 파일 자동 반영 결과를 터미널에 한눈에 — dashboard_restart.bat이 재시작 + 실적 다시 읽기 뒤에 부름.

data/perf_update_status.json(서버가 쓰는 파일)을 **읽기만** 함 — 로그인 필요 없는 API로는 상태를 볼 수 없어서 파일을 직접 읽음.
최상위 = 실적 뷰(N월 집계/추정 시트), "plan27" 키 = 2027 사업계획 뷰. 서버를 안 거치니 pandas 등을 불러오지 않아 바로 끝남.
"""
import json
import sys
from pathlib import Path

STATUS = Path(__file__).resolve().parent.parent / "data" / "perf_update_status.json"


def show(title: str, st: dict) -> None:
    if not st:
        print(f"[{title}] 기록 없음 — 이 파일에 해당 시트가 없거나 아직 읽지 않았습니다")
        return
    checks = st.get("checks") or []
    passed = sum(1 for c in checks if c.get("ok"))
    mark = "OK  " if st.get("ok") else "실패"
    print(f"[{title}] {mark} · {st.get('checked_at', '?')} 확인")
    print(f"    파일: {st.get('file', '?')}")
    print(f"    시트: {st.get('sheet', '?')} · 열 맞춤: {st.get('method', '?')} · 계산식 검증 {passed}/{len(checks)} 통과")
    if st.get("totals"):
        print("    합계(억): " + " / ".join(f"{k} {v}" for k, v in st["totals"].items()))
    for c in checks:
        if not c.get("ok"):
            print(f"    ✗ {c.get('name')} — {c.get('rate')}%")
    if st.get("changes"):
        print("    바뀐 점: " + " | ".join(st["changes"][:4]) + (" …" if len(st["changes"]) > 4 else ""))
    if not st.get("ok"):
        print(f"    이유: {st.get('error') or '(기록 없음)'}")
        serving = st.get("serving")
        print(f"    → 화면은 직전 정상 파일로 표시 중: {serving}" if serving else "    → 표시할 직전 정상 파일이 없습니다")


def main() -> int:
    try:
        data = json.loads(STATUS.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"상태 파일이 없습니다: {STATUS}")
        return 1
    except ValueError as e:
        print(f"상태 파일을 읽을 수 없습니다: {e}")
        return 1
    show("실적 뷰", {k: v for k, v in data.items() if k != "plan27"})
    show("2027 계획 뷰", data.get("plan27") or {})
    bad = [n for n, st in (("실적", {k: v for k, v in data.items() if k != "plan27"}), ("계획", data.get("plan27") or {}))
           if st and not st.get("ok")]
    return 2 if bad else 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")   # chcp 65001 이어도 파이프·리다이렉트면 cp949로 깨질 수 있어 고정
    sys.exit(main())
