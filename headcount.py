"""파트별 인원(관리자 수기 입력) 저장·읽기와 인당 계산 — 2026-10-23.

원본 엑셀엔 파트 인원이 없고 자주 바뀌어서, 관리자가 입력한 값을 서버 파일(data/headcount.json)에 두고
실적 요약(performance.api_perf_summary)이 인당 값을 계산해 내려준다. 키는 원문자 접두를 뗀 파트명("AIㆍDS").
인원은 두 가지(2026-10-23): `parts` = 현재 인원(처음부터 있던 키 — 옛 파일 호환), `plan_parts` = 계획 인원.
인당 계획 매출은 계획 인원으로, 인당 추정 매출·손익·관리비는 현재 인원으로 나눈다.
설정 API(/api/settings/headcount)는 app.py, 계산은 여기 — 순환 import를 피하려 Flask 의존 없이 둠.
"""
import json
import logging
import os
import threading
from datetime import datetime
from pathlib import Path

from shared import strip_part_prefix

logger = logging.getLogger(__name__)

HEADCOUNT_PATH = Path(__file__).parent / "data" / "headcount.json"   # 테스트는 이 값을 바꿔 끼움
HEADCOUNT_MAX = 999
lock = threading.Lock()


def _num(v):
    """입력값 → 0~999 정수(명). 소수·숫자가 아닌 값은 None. "12"·12·12.0은 12."""
    if isinstance(v, bool) or not isinstance(v, (int, float, str)):
        return None
    try:
        n = float(str(v).strip())
    except ValueError:
        return None
    if n != n or n < 0 or n > HEADCOUNT_MAX or n != int(n):   # NaN·음수·상한 초과·소수
        return None
    return int(n)


def read_headcount() -> dict:
    """{"parts": {파트명: 현재 인원}, "plan_parts": {파트명: 계획 인원}, "updated_at": "", "updated_by": ""}
    — 파일이 없거나 깨지면 전부 미입력. 옛 파일(plan_parts 없음)은 계획 인원이 전부 미입력."""
    out = {"parts": {}, "plan_parts": {}, "updated_at": "", "updated_by": ""}
    try:
        saved = json.loads(HEADCOUNT_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return out
    except Exception:
        logger.warning("파트 인원 파일을 못 읽음 — 전부 미입력으로 처리: %s", HEADCOUNT_PATH)
        return out
    if not isinstance(saved, dict):
        return out
    for key in ("parts", "plan_parts"):
        raw = saved.get(key)
        if isinstance(raw, dict):
            for k, v in raw.items():
                n = _num(v)
                name = strip_part_prefix(k)
                if n and name:
                    out[key][name] = n
    for k in ("updated_at", "updated_by"):
        if isinstance(saved.get(k), str):
            out[k] = saved[k]
    return out


def validate_parts(raw) -> "tuple[dict, str | None]":
    """PUT 본문의 parts → (정리된 맵, 오류 문구). 0·빈 값은 '미입력'이라 맵에서 뺌."""
    if not isinstance(raw, dict):
        return {}, "parts가 객체가 아닙니다"
    clean = {}
    for k, v in raw.items():
        name = strip_part_prefix(k) if isinstance(k, str) else ""
        if not name:
            return {}, "파트명이 비어 있습니다"
        if v is None or (isinstance(v, str) and not v.strip()):
            continue
        n = _num(v)
        if n is None:
            return {}, f"인원 값이 잘못됨: {name} (0~{HEADCOUNT_MAX} 정수)"
        if n > 0:
            clean[name] = n
    return clean, None


def write_headcount(parts: dict, plan_parts: dict, updated_by: str) -> dict:
    """현재·계획 인원 전체 맵을 통째로 교체(임시파일 → os.replace). 호출 전에 validate_parts를 거칠 것."""
    data = {"parts": parts, "plan_parts": plan_parts, "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "updated_by": updated_by}
    with lock:
        HEADCOUNT_PATH.parent.mkdir(exist_ok=True)
        tmp = HEADCOUNT_PATH.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, HEADCOUNT_PATH)
    logger.info("[파트 인원] %s 변경 — 현재 %d개·계획 %d개 파트", updated_by or "?", len(parts), len(plan_parts))
    return data


def per_head(value, headcount):
    """금액(천원) ÷ 인원. 값·인원이 없거나 0 이하면 None(화면은 막대를 안 그림)."""
    if value is None or not headcount or headcount <= 0:
        return None
    return float(value) / float(headcount)


def per_head_fields(stats: dict, headcount, plan_headcount=None) -> dict:
    """by_part 한 파트의 인당 값(천원) — 계획 매출만 계획이 있고 손익·관리비는 추정(연간) 값만 있다.
    인당 계획 매출은 계획 인원, 나머지는 현재 인원(headcount)으로 나눔."""
    return {
        "headcount":         headcount,
        "plan_headcount":    plan_headcount,
        "rev_per_head_plan": per_head(stats.get("plan_initial"), plan_headcount),
        "rev_per_head_est":  per_head(stats.get("jun_check_total"), headcount),
        "profit_per_head":   per_head(stats.get("operating_profit"), headcount),
        "mgmt_per_head":     per_head(stats.get("cost_mgmt"), headcount),
    }
