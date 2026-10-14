"""실적현황 파일 자동 반영(2026-10-14) — 사람은 data/에 새 '사업계획 통합관리 파일'을 넣기만 하면 됨.

새 파일을 처음 읽을 때(performance.load_perf_excel) 이 모듈이:
  1. 최신 시트(YYYY년 (N월 집계|추정))를 고르고
  2. 열 매핑을 정함 — 코드에 적은 맵(_PERF_COL_MAPS) → 예전에 학습한 맵(data/perf_col_maps.json) →
     없으면 **기준 시트**(같은 파일 안 이미 아는 지난달 시트, 없으면 지금 쓰던 파일의 시트)와 머리글 글자를 대조해 자동으로 맞춤
     ("8월 점검"과 "9월 점검"처럼 숫자만 다른 건 같은 열로 봄). 그래도 못 찾은 필수 열은 H-chat이 머리글을 보고 제안
  3. **계산식으로 검증** — 엑셀 원본 수식(매출이익 = 매출 − 직접원가 등)이 전 행에서 맞는지. AI가 틀리게 맞춰도 여기서 막힘
  4. 통과하면 그 매핑을 기억(data/perf_col_maps.json)하고 반영, 실패하면 performance가 직전 파일로 계속 보여줌
  5. 결과(무엇이 바뀌었는지 H-chat 요약·검증 표·합계)를 data/perf_update_status.json에 → 관리자 기능 창에 표시
H-chat에는 머리글 글자만 보냄(금액·프로젝트명 등 데이터는 안 보냄).
"""
from __future__ import annotations

import difflib
import json
import logging
import os
import re
import threading
from datetime import datetime

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
STATUS_PATH = os.path.join(_DATA_DIR, "perf_update_status.json")
_status_lock = threading.Lock()

# 검증 통과 기준 — 9월 파일 실측은 전 항목 100%. 원본 수기 예외 몇 줄은 봐줌
_PASS_RATE = 95.0
_TOL = 1.0   # 천원 — 반올림 오차

# 열 매핑에 꼭 있어야 하는 필드(없으면 대시보드 계산이 깨짐) — 나머지는 없어도 그 컬럼만 빈 칸
REQUIRED_FIELDS = [
    "team", "part", "use_yn", "progress", "category", "project_code", "project_name", "manager",
    "plan_initial", "jun_check_total", "profit_gross", "cost_direct", "cost_labor", "cost_overhead",
    "cost_mgmt", "operating_profit", "profit_rate_raw", "plan_diff_amount",
] + [f"chk_m{m:02d}" for m in range(1, 13)]


# ── 머리글 ─────────────────────────────────────────────────────
def header_labels(path: str, sheet: str) -> list[str]:
    """머리글 2줄(그룹/세부 — 엑셀 11·12행) 글자. 3번째 줄은 숫자라 제외(scripts/check_perf_headers.py와 같은 규칙)"""
    engine = "pyxlsb" if path.endswith(".xlsb") else "openpyxl"
    df = pd.read_excel(path, sheet_name=sheet, header=None, skiprows=10, nrows=3, engine=engine)
    out = []
    for c in range(df.shape[1]):
        parts = []
        for r in range(2):
            v = df.iloc[r, c]
            if pd.notna(v) and not isinstance(v, (int, float)):
                parts.append(str(v).replace("\n", " ").strip())
        out.append(" / ".join(parts))
    return out


def _norm(label: str) -> str:
    """달·연도 숫자는 매달 바뀌니 빼고 비교 — "8월 점검 / 합계" == "9월 점검 / 합계", "25년" == "26년" """
    s = re.sub(r"\d+\s*월", "N월", label)
    s = re.sub(r"\d{2,4}\s*년", "N년", s)
    return re.sub(r"\s+", " ", s).strip()


def align_map(ref_labels: list[str], ref_map: dict[int, str], new_labels: list[str]):
    """기준 시트 매핑을 새 시트로 옮김 — 머리글(달·연도 숫자 뺀 글자)을 순서대로 대조(difflib).
    반환: (새 매핑, 바뀐 점 글자 목록, 못 찾은 필드 목록)"""
    a = [_norm(x) for x in ref_labels]
    b = [_norm(x) for x in new_labels]
    old_to_new: dict[int, int] = {}
    changes: list[str] = []
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                old_to_new[i1 + k] = j1 + k
        elif tag == "replace" and (i2 - i1) == (j2 - j1):
            # 같은 자리 글자만 바뀜 — 일단 같은 열로 보고(검증이 최종 판단) 바뀐 점으로 남김
            for k in range(i2 - i1):
                old_to_new[i1 + k] = j1 + k
                if ref_map.get(i1 + k):
                    changes.append(f"{_col(j1 + k)}열 머리글 바뀜: '{ref_labels[i1 + k]}' → '{new_labels[j1 + k]}'")
        elif tag in ("insert", "replace"):
            changes.append(f"{_col(j1)}~{_col(j2 - 1)}열 새로 생김: {', '.join(repr(x) for x in new_labels[j1:j2] if x) or '(빈 머리글)'}")
        if tag in ("delete", "replace") and (i2 - i1) != (j2 - j1):
            gone = [ref_labels[i] for i in range(i1, i2) if ref_map.get(i)]
            if gone:
                changes.append(f"기준 시트의 {', '.join(repr(x) for x in gone)} 열을 새 시트에서 못 찾음")
    # 열이 밀린 구간 — "+1칸(R열부터)"처럼 밀리기 시작한 새 열 기준
    first_by_shift: dict[int, int] = {}
    for i, j in sorted(old_to_new.items()):
        if ref_map.get(i) and j - i != 0:
            first_by_shift.setdefault(j - i, j)
    if first_by_shift:
        changes.insert(0, "열 위치 이동: " + ", ".join(
            f"{'+' if s > 0 else ''}{s}칸({_col(j)}열부터)" for s, j in sorted(first_by_shift.items(), key=lambda x: x[1])))
    new_map = {old_to_new[i]: f for i, f in ref_map.items() if i in old_to_new}
    missing = [f for i, f in ref_map.items() if i not in old_to_new]
    return new_map, changes, missing


def _col(i: int) -> str:
    """0부터 센 열 번호 → 엑셀 열 글자"""
    s, n = "", i + 1
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


# ── H-chat ─────────────────────────────────────────────────────
def _hchat(system: str, user: str, max_tokens: int = 900) -> str:
    from ai_insight import _call_hchat
    return _call_hchat(system, user, max_tokens=max_tokens)


def ai_fill_missing(missing: list[str], ref_labels, ref_map, new_labels, new_map) -> dict[int, str]:
    """못 찾은 필드를 H-chat에게 — 머리글 글자만 보내고 {"필드": 열번호} JSON을 받음. 이미 쓴 열·범위 밖은 버림"""
    if not missing:
        return {}
    field_idx = {f: i for i, f in ref_map.items()}
    used = set(new_map)
    free = [(j, lab) for j, lab in enumerate(new_labels) if j not in used and lab]
    ask = [{"field": f, "기준_머리글": ref_labels[field_idx[f]] if field_idx[f] < len(ref_labels) else ""} for f in missing]
    system = ("너는 엑셀 열 매핑 도우미다. 지난달 시트의 머리글과 이번 달 시트의 남은 열 머리글을 보고, "
              "각 필드가 이번 달 어느 열(0부터 센 번호)인지 고른다. 확실하지 않으면 그 필드는 빼라. "
              "반드시 JSON 객체 하나만 출력: {\"필드\": 열번호, ...}")
    user = json.dumps({"못_찾은_필드": ask, "이번달_남은_열": [{"열": j, "머리글": lab} for j, lab in free]},
                      ensure_ascii=False)
    try:
        text = _hchat(system, user, max_tokens=600)
        m = re.search(r"\{.*\}", text, re.S)
        raw = json.loads(m.group(0)) if m else {}
    except Exception:
        logger.warning("H-chat 열 매핑 제안 실패", exc_info=True)
        return {}
    out = {}
    for f, j in raw.items():
        if f in missing and isinstance(j, int) and 0 <= j < len(new_labels) and j not in used and j not in out:
            out[j] = f
    return out


def ai_summary(sheet: str, method: str, changes: list[str], checks: list[dict], totals: dict) -> str:
    """관리자에게 보여줄 3~5줄 요약 — 실패하면 빈 문자열(화면은 바뀐 점 목록을 그대로 보여줌)"""
    system = ("너는 경영실적 대시보드의 데이터 담당자다. 새 실적 엑셀을 반영한 결과를 관리자에게 한국어 3~5줄로 보고한다. "
              "주어진 값만 쓰고 숫자를 지어내지 마라. 열 변화·검증 결과·합계 변화를 요약하고, 확인이 필요하면 말해라. 마크다운 쓰지 마라.")
    user = json.dumps({"시트": sheet, "열_매핑_방법": method, "바뀐_점": changes, "검증": checks, "합계(억원)": totals},
                      ensure_ascii=False)
    try:
        return _hchat(system, user, max_tokens=500)
    except Exception:
        logger.warning("H-chat 요약 실패", exc_info=True)
        return ""


# ── 검증 ───────────────────────────────────────────────────────
def validate(df: pd.DataFrame) -> list[dict]:
    """엑셀 원본 수식이 전 행에서 맞는지 — 9월 파일 실측 전부 100%(2026-10-14 세션). 매출행 기준, 오차 1천원"""
    rev = df[df["category"] == "매출"]
    n = lambda c: pd.to_numeric(rev[c], errors="coerce").fillna(0).to_numpy()   # noqa: E731

    def rate(a, b):
        if not len(a):
            return 0.0
        return round(float(np.isclose(a, b, atol=_TOL).mean() * 100), 1)

    months = sum(n(f"chk_m{m:02d}") for m in range(1, 13))
    # 매출행 직접원가(BB) = 바로 아래 원가행의 연간 합계(BH) — 두 행을 잇는 고리
    cat = df["category"].to_numpy()
    bh = pd.to_numeric(df["jun_check_total"], errors="coerce").fillna(0).to_numpy()
    bb = pd.to_numeric(df["cost_direct"], errors="coerce").fillna(0).to_numpy()
    pairs = [(bb[i], bh[i + 1]) for i in range(len(df) - 1) if cat[i] == "매출" and cat[i + 1] == "원가"]
    pa = np.array([p[0] for p in pairs]); pb = np.array([p[1] for p in pairs])

    checks = [
        ("매출이익 = 연간 합계 − 직접원가", rate(n("profit_gross"), n("jun_check_total") - n("cost_direct"))),
        ("경상손익 = 매출이익 − 인건비 − 공통원가 − 관리비",
         rate(n("operating_profit"), n("profit_gross") - n("cost_labor") - n("cost_overhead") - n("cost_mgmt"))),
        ("연간 합계 = 1~12월 합", rate(n("jun_check_total"), months)),
        ("계획 대비 차이 = 연간 합계 − 최초 사업계획", rate(n("plan_diff_amount"), n("jun_check_total") - n("plan_initial"))),
        ("매출행 직접원가 = 바로 아래 원가행 연간 합계", rate(pa, pb) if len(pairs) else 0.0),
    ]
    out = [{"name": k, "rate": v, "ok": v >= _PASS_RATE} for k, v in checks]
    filled = lambda c: round(float((rev[c].astype(str).str.strip() != "").mean() * 100), 1) if len(rev) else 0.0  # noqa: E731
    for c, label in (("part", "파트 채워짐"), ("project_name", "프로젝트명 채워짐")):
        v = filled(c)
        out.append({"name": label, "rate": v, "ok": v >= _PASS_RATE})
    out.append({"name": f"매출행 수 {len(rev)} (50 이상)", "rate": 100.0 if len(rev) >= 50 else 0.0, "ok": len(rev) >= 50})
    return out


def _totals(df: pd.DataFrame) -> dict:
    rev = df[df["category"] == "매출"]
    eok = lambda c: round(float(pd.to_numeric(rev[c], errors="coerce").fillna(0).sum()) / 100_000, 1)  # noqa: E731
    return {"계획 매출": eok("plan_initial"), "연간 추정 매출": eok("jun_check_total"),
            "경상손익": eok("operating_profit"), "프로젝트(매출행)": int(len(rev))}


# ── 상태 저장 ──────────────────────────────────────────────────
def read_status() -> dict:
    try:
        with open(STATUS_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, ValueError):
        return {}


def write_status(st: dict) -> None:
    with _status_lock:
        os.makedirs(_DATA_DIR, exist_ok=True)
        tmp = STATUS_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(st, f, ensure_ascii=False, indent=2)
        os.replace(tmp, STATUS_PATH)


def _save_learned_map(sheet: str, col_map: dict[int, str]) -> None:
    import performance
    path = performance.PERF_LEARNED_MAPS_PATH
    try:
        with open(path, encoding="utf-8") as f:
            maps = json.load(f)
    except (FileNotFoundError, ValueError):
        maps = {}
    maps[sheet] = {str(k): v for k, v in sorted(col_map.items())}
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(maps, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


# ── 준비(검증까지) ─────────────────────────────────────────────
def prepare(path: str, prev_good: "dict | None" = None):
    """새 파일 준비 — 성공하면 (df, sheet, year, month, status), 실패하면 ValueError(status는 기록됨).
    prev_good: 직전에 잘 읽힌 파일 {"file": 경로, "sheet": 시트} — 같은 파일 안에 아는 시트가 없을 때 기준으로 씀"""
    import performance
    st = {"checked_at": datetime.now().strftime("%Y-%m-%d %H:%M"), "file": os.path.basename(path),
          "ok": False, "changes": [], "checks": [], "summary": "", "error": ""}
    try:
        if open(path, "rb").read(4) == b"\xd0\xcf\x11\xe0":
            raise ValueError("파일이 보안(AIP/DRM) 암호화돼 있어 읽을 수 없습니다 — 암호화 안 된 파일로 넣어 주세요")
        engine = "pyxlsb" if path.endswith(".xlsb") else "openpyxl"
        with pd.ExcelFile(path, engine=engine) as xf:
            sheets = xf.sheet_names
        sheet = performance._resolve_perf_sheet(sheets)
        st["sheet"] = sheet

        col_map = performance.perf_col_map(sheet)
        method = "기존 매핑"
        if not col_map:
            # 기준 시트 — 같은 파일 안 이미 아는 시트 중 가장 최근(대상보다 이전), 없으면 직전 파일의 시트
            ref = None
            known = []
            for name in sheets:
                m = performance._PERF_SHEET_RE.match(str(name).strip())
                if m and name != sheet and performance.perf_col_map(name):
                    known.append(((int(m.group(1)), int(m.group(2)), m.group(3) == "집계"), name))
            if known:
                ref = (path, max(known)[1])
            elif prev_good and prev_good.get("file") and os.path.exists(prev_good["file"]) and \
                    performance.perf_col_map(prev_good.get("sheet", "")):
                ref = (prev_good["file"], prev_good["sheet"])
            if not ref:
                raise ValueError(f"'{sheet}' 시트의 열을 맞출 기준 시트가 없습니다(아는 지난달 시트 없음)")
            ref_map = performance.perf_col_map(ref[1])
            ref_labels = header_labels(ref[0], ref[1])
            new_labels = header_labels(path, sheet)
            col_map, changes, missing = align_map(ref_labels, ref_map, new_labels)
            method = f"자동 정렬(기준: {ref[1]}{'' if ref[0] == path else ' · ' + os.path.basename(ref[0])})"
            st["changes"] = changes
            if missing:
                found = ai_fill_missing(missing, ref_labels, ref_map, new_labels, col_map)
                if found:
                    col_map.update(found)
                    method += " + H-chat 보완"
                    st["changes"].append("H-chat이 맞춘 열: " + ", ".join(f"{f} → {_col(j)}열" for j, f in found.items()))
                still = [f for f in missing if f not in col_map.values()]
                if still:
                    st["changes"].append("끝내 못 찾은 열(빈 칸으로 둠): " + ", ".join(still))
            lack = [f for f in REQUIRED_FIELDS if f not in col_map.values()]
            if lack:
                raise ValueError("필수 열을 못 찾음: " + ", ".join(lack))
        st["method"] = method

        df, sheet, year, month = performance.read_perf_frame(path, sheet, col_map)
        st["checks"] = validate(df)
        st["totals"] = _totals(df)
        st["base"] = {"year": year, "month": month}
        failed = [c["name"] for c in st["checks"] if not c["ok"]]
        if failed:
            raise ValueError("계산식 검증 실패: " + " / ".join(failed))

        if method != "기존 매핑":
            _save_learned_map(sheet, col_map)
        st["ok"] = True
        st["summary"] = ai_summary(sheet, method, st["changes"], st["checks"], st["totals"]) if method != "기존 매핑" else ""
        write_status(st)
        logger.info("실적 새 파일 준비 완료: %s / %s (%s)", st["file"], sheet, method)
        return df, sheet, year, month, st
    except Exception as e:
        st["error"] = str(e)
        st["failed_mtime"] = os.path.getmtime(path) if os.path.exists(path) else None
        prev = read_status()
        for k in ("good", "serving", "serving_sheet"):   # 직전에 잘 되던 파일 정보는 유지
            if k in prev:
                st[k] = prev[k]
        write_status(st)
        logger.error("실적 새 파일 준비 실패(%s): %s", st["file"], e)
        raise ValueError(str(e)) from e
