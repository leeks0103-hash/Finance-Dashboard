"""AI(H-Chat/Claude) 기반 대시보드 자동 분석 — 경영실적/재무데이터, KPI/경영현황 탭.

docs/dashboard-analysis-guide.md Part 6·7의 해석 규칙을 시스템 프롬프트로 박아넣고,
그 문서 Part 1~4에서 실측한 함정(달성률 착시·원가 이중의미·적자 건수 vs 매출가중 등)을
숫자는 전부 이 모듈이 Python으로 미리 계산해서 넘긴다 — AI는 해석·서술만 담당
(LLM이 직접 나눗셈하게 하면 계산 오류가 섞인다는 게 이 문서 Part 8의 핵심 원칙).

캐시: 원본 데이터(mtime) 기준 — 재추출 전까지는 같은 분석문을 재사용하고, H-Chat을
매 요청마다 부르지 않는다. data/ai_analysis_cache.json에 저장해 서버 재시작에도 유지.
"""
import json
import logging
import os
import threading
from datetime import datetime

import httpx
import pandas as pd
from dotenv import load_dotenv
from flask import Blueprint, jsonify, request
from openpyxl import load_workbook

import performance as P
import kpi as K
import paths as _paths

load_dotenv()

logger = logging.getLogger(__name__)

ai_bp = Blueprint("ai", __name__)

H_CHAT_API_KEY  = os.environ.get("H_CHAT_API_KEY", "")
H_CHAT_BASE_URL = os.environ.get(
    "H_CHAT_BASE_URL",
    "https://internal-apigw-kr.hmg-corp.io/hchat-in/api/v3/claude/messages",
)
H_CHAT_MODEL = os.environ.get("H_CHAT_API_MODEL", "claude-sonnet-4-6")

# 사내 API 게이트웨이가 내부 CA 인증서를 써서 verify=True면 SSL 오류 — qna_crawler 프로젝트의
# 기존 H-Chat 연동(ai_classify.py)과 동일하게 verify=False 사용
_client = httpx.Client(verify=False, timeout=60)

_CACHE_FILE = os.path.join(_paths.DATA_DIR, "ai_analysis_cache.json")
_cache_lock = threading.Lock()


def _load_cache() -> dict:
    if not os.path.exists(_CACHE_FILE):
        return {}
    try:
        with open(_CACHE_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_cache(cache: dict) -> None:
    try:
        with open(_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning("AI 분석 캐시 저장 실패: %s", e)


def _call_hchat(system_prompt: str, user_message: str, max_tokens: int = 1600) -> str:
    if not H_CHAT_API_KEY:
        raise RuntimeError("H_CHAT_API_KEY가 설정되지 않았습니다 (.env 확인)")
    r = _client.post(
        H_CHAT_BASE_URL,
        headers={"Authorization": H_CHAT_API_KEY, "Content-Type": "application/json"},
        json={
            "model": H_CHAT_MODEL,
            "max_tokens": max_tokens,
            "temperature": 0.3,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_message}],
        },
    )
    r.raise_for_status()
    data = r.json()
    return data["content"][0]["text"].strip()


# ──────────────────────────────────────────────────────────────
# 경영실적/재무데이터 탭 — 지표 계산 (전부 결정론적, LLM은 해석만)
# ──────────────────────────────────────────────────────────────
def _round1(v) -> float:
    try:
        return round(float(v), 1)
    except Exception:
        return 0.0


def _build_finance_metrics() -> dict:
    df = P.get_perf_df()
    if df.empty:
        return {}
    rev = df[df["category"] == "매출"].copy()
    month = P._perf_current_month or 1

    tot_plan = rev["plan_initial"].sum()
    tot_acc  = rev["jun_actual"].sum()
    tot_est  = rev["jun_check_total"].sum()
    pace_expected = tot_plan * month / 12

    by_part = []
    for part, g in rev.groupby("part"):
        pl, ac, es = g["plan_initial"].sum(), g["jun_actual"].sum(), g["jun_check_total"].sum()
        loss = g[g["operating_profit"] < 0]
        tc = g["cost_direct"].sum() + g["cost_labor"].sum() + g["cost_overhead"].sum() + g["cost_mgmt"].sum()
        remain_needed = es - ac
        month_avg_so_far = ac / month if month else 0
        month_avg_needed = remain_needed / max(12 - month, 1)
        by_part.append({
            "파트": part, "건수": int(len(g)),
            "계획_억": _round1(pl / 1e5), "누계_억": _round1(ac / 1e5), "연간추정_억": _round1(es / 1e5),
            "손익률_pct": _round1(g["operating_profit"].sum() / es * 100) if es > 0 else None,
            "원가율_pct": _round1(tc / es * 100) if es > 0 else None,
            "매출이익률_pct": _round1(g["profit_gross"].sum() / es * 100) if es > 0 else None,
            "적자매출_억": _round1(loss["jun_check_total"].sum() / 1e5),
            "적자매출비중_pct": _round1(loss["jun_check_total"].sum() / es * 100) if es > 0 else None,
            "적자건수": int(len(loss)), "적자건수비중_pct": _round1(len(loss) / len(g) * 100) if len(g) else None,
            "필요배수": _round1(month_avg_needed / month_avg_so_far) if month_avg_so_far > 0 else None,
        })

    biz_rows = []
    if "biz_type" in rev.columns:
        for v, g in rev.groupby("biz_type"):
            es = g["jun_check_total"].sum()
            if es <= 0 or len(g) < 3:
                continue
            biz_rows.append({
                "사업구분": v, "건수": int(len(g)), "추정매출_억": _round1(es / 1e5),
                "손익률_pct": _round1(g["operating_profit"].sum() / es * 100),
            })
    edu_rows = []
    if "edu_type" in rev.columns:
        for v, g in rev.groupby("edu_type"):
            es = g["jun_check_total"].sum()
            if es <= 0 or len(g) < 3:
                continue
            edu_rows.append({
                "교육형태": v, "건수": int(len(g)), "추정매출_억": _round1(es / 1e5),
                "손익률_pct": _round1(g["operating_profit"].sum() / es * 100),
            })
    biz_rows.sort(key=lambda r: r["손익률_pct"], reverse=True)
    edu_rows.sort(key=lambda r: r["손익률_pct"], reverse=True)

    noplan = rev[(rev["plan_initial"] <= 0) & (rev["jun_check_total"] > 0)]
    noact  = rev[(rev["plan_initial"] > 0) & (rev["jun_actual"] <= 0)]

    return {
        "기준월": month,
        "전체": {
            "계획_억": _round1(tot_plan / 1e5), "누계_억": _round1(tot_acc / 1e5),
            "연간추정_억": _round1(tot_est / 1e5),
            "단순달성률_pct": _round1(tot_acc / tot_plan * 100) if tot_plan else None,
            "안분달성률_pct": _round1(tot_acc / pace_expected * 100) if pace_expected else None,
            "연간전망률_pct": _round1(tot_est / tot_plan * 100) if tot_plan else None,
            "안분기준선_pct": _round1(month / 12 * 100),
        },
        "파트별": sorted(by_part, key=lambda r: (r["적자매출비중_pct"] or 0), reverse=True),
        "사업구분별_손익률상하위": {"상위": biz_rows[:3], "하위": biz_rows[-3:]},
        "교육형태별_손익률상하위": {"상위": edu_rows[:3], "하위": edu_rows[-3:]},
        "계획누락_건수": int(len(noplan)), "계획누락_금액_억": _round1(noplan["jun_check_total"].sum() / 1e5),
        "미착수_건수": int(len(noact)), "미착수_계획액_억": _round1(noact["plan_initial"].sum() / 1e5),
        "재무_코드충돌_건수": _count_code_conflicts(_paths.FINANCE_EXCEL_PATH),
    }


_FINANCE_SYSTEM_PROMPT = """당신은 현대차그룹 기술교육 조직의 경영관리 애널리스트입니다.
전달된 실적 데이터(이미 계산된 지표)를 읽고, 팀장·경영진이 5분 안에 파악할 수 있는
분석문을 작성하세요.

## 어조
- 차분하고 부드러운 어조로 씁니다. 과장되거나 공격적인 표현(예: "몰아치기", "최악",
  "위기", "치명적")은 쓰지 마세요 — 사실과 숫자로 담담하게 전달하세요.
- 🔴🟡🟢 같은 신호등 색 이모지나 상태 아이콘은 쓰지 마세요. 강조가 필요하면
  굵은 글씨나 문장으로 표현하세요.
- 우려되는 부분도 "확인이 필요합니다", "다시 살펴보면 좋겠습니다"처럼 함께 챙겨보자는
  투로 씁니다.

## 반드시 지킬 해석 규칙 (위반 시 분석 전체가 무효)
1. 달성률은 절대 단독으로 말하지 마세요. "단순달성률/안분달성률/연간전망률" 3개를 함께
   제시하고, 안분기준선(경과월/12)을 명시하세요.
   예: "달성률 45.2%지만 8월 기준선 66.7% 대비 안분 달성률은 67.8%로 정상 페이스입니다."
2. 적자는 절대 건수만으로 말하지 마세요. "적자매출비중_pct"(매출 가중)를 반드시 함께
   제시하세요. 건수 비중과 매출 비중이 다르면 그 자체가 눈여겨볼 발견입니다.
3. 필요배수가 2 이상인 파트는 "연말에 남은 기간 동안 챙겨야 할 부담이 큰 파트"로
   부드럽게 표현하세요.
4. 손익률/원가율은 이미 금액 가중평균으로 계산되어 있습니다 — 다시 계산하지 말고 그대로 쓰세요.
5. 숫자는 전달된 값만 쓰세요. 스스로 계산하지 마세요(나눗셈·비율 재계산 금지).
6. 재무_코드충돌_건수가 0보다 크면 마지막에 짧게 "데이터 확인 요청: 코드충돌 N건 —
   해당 PPT 데이터는 한쪽이 덮어써졌을 수 있어 함께 확인해주시면 좋겠습니다"라고 안내하세요.

## 서술 규칙
- 모든 발견은 "무슨 일이 일어났나 → 왜 중요한가 → 무엇을 해보면 좋을까" 순서로.
- 비교 기준 없는 숫자 금지 (반드시 계획/전기/기준선 중 하나와 비교).
- 모호한 헤지("~일 수 있습니다")는 남발하지 말고, 확인이 필요하면 "확인 필요: X"로
  대상을 구체적으로 짚어주세요.
- 숫자 없는 문장 금지.

## 출력 구조 (총 900자 이내, 마크다운 간단히 사용 가능)
1. **한 줄 요약** — 연말 착지 전망 + 가장 눈여겨볼 부분
2. **착지 전망** — 계획/누계/안분기대치/연간추정, 안분 달성률로 페이스 판정
3. **연말 페이스 점검** — 필요배수 2 이상 파트, 남은 기간의 부담 정도
4. **수익성 살펴보기** — 파트별 손익률/원가율, 적자매출비중 기준으로 가장 눈에 띄는 파트 짚기
5. **무엇이 도움이 되는가** — 사업구분/교육형태 상위·하위 3개, 규모×수익성 해석
6. **함께 챙겨보면 좋을 것** — 최대 5개, 금액 영향 순, [대상] 사실→원인추정→제안 형식
"""


def get_finance_analysis(force: bool = False) -> dict:
    df = P.get_perf_df()
    data_key = str(P._perf_cached_mtime)
    cache = _load_cache()
    entry = cache.get("finance")
    if not force and entry and entry.get("data_key") == data_key:
        return entry

    metrics = _build_finance_metrics()
    if not metrics:
        return {"text": "실적 데이터가 없어 분석할 수 없습니다.", "generated_at": None, "data_key": data_key}

    user_message = "다음은 이번 회차 실적 데이터의 사전 계산 지표입니다(JSON):\n" + \
        json.dumps(metrics, ensure_ascii=False, indent=2)
    text = _call_hchat(_FINANCE_SYSTEM_PROMPT, user_message)

    entry = {
        "text": text,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "data_key": data_key,
    }
    with _cache_lock:
        cache["finance"] = entry
        _save_cache(cache)
    return entry


# ──────────────────────────────────────────────────────────────
# KPI/경영현황 탭 — 지표 계산
# ──────────────────────────────────────────────────────────────
_KPI_ITEMS = ["NPS", "전략기술과정_건수", "전략기술과정_적절성", "특화교육체계_건수",
              "AI교육_고객사건수", "AI교육_적절성", "신사업_매출억", "신사업_신규기존건수"]


def _kpi_num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(",", "")
    if s in {"", "-", "N"}:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _build_kpi_metrics() -> dict:
    df = K.get_kpi_df()
    if df.empty:
        return {}
    total_rows = len(df)

    fill_rates = []
    for item in _KPI_ITEMS:
        gcol, acol = f"{item}_PJ목표", f"{item}_PJ실적"
        if gcol not in df.columns:
            continue
        g_filled = sum(1 for v in df[gcol] if _kpi_num(v) is not None)
        a_filled = sum(1 for v in df[acol] if _kpi_num(v) is not None)
        g_vals = [_kpi_num(v) for v in df[gcol]]
        a_vals = [_kpi_num(v) for v in df[acol]]
        g_sum = sum(v for v in g_vals if v is not None)
        a_sum = sum(v for v in a_vals if v is not None)
        fill_rates.append({
            "항목": item,
            "목표기재율_pct": _round1(g_filled / total_rows * 100),
            "실적기재율_pct": _round1(a_filled / total_rows * 100),
            "목표합계": _round1(g_sum), "실적합계": _round1(a_sum),
            "판정": "분석가능" if g_filled / total_rows >= 0.5 and a_filled / total_rows >= 0.5
                    else ("참고용" if g_filled / total_rows >= 0.5 or a_filled / total_rows >= 0.5 else "집계불가"),
        })

    by_part = []
    if "파트명" in df.columns:
        for part, g in df.groupby("파트명"):
            by_part.append({"파트": part, "행수": int(len(g))})

    return {
        "전체행수": total_rows,
        "항목별_기재율": fill_rates,
        "파트별_행수": by_part,
        "코드충돌_건수": _count_code_conflicts(K.KPI_EXCEL_PATH),
    }


def _count_code_conflicts(xlsx_path: str) -> int:
    """extract_*.py가 남긴 '코드충돌' 시트 건수 — 서로 다른 PPT가 같은 (코드/연도/단계) 키를
    공유해 한쪽 행이 덮어써진 경우만 집계. 같은 프로젝트가 제안→착수→완료로 여러 단계
    보고된 정상적인 경우(프로젝트코드 자체의 단순 중복)와는 다르다 — 그건 오탐이라 여기서
    별도로 세지 않고, 이미 추출 시점에 판별된 이 시트만 신뢰한다."""
    try:
        wb = load_workbook(xlsx_path, data_only=True, read_only=True)
    except Exception:
        return 0
    try:
        if "코드충돌" not in wb.sheetnames:
            return 0
        return sum(1 for r in wb["코드충돌"].iter_rows(min_row=2, values_only=True) if r and r[0])
    finally:
        wb.close()


_KPI_SYSTEM_PROMPT = """당신은 현대차그룹 기술교육 조직의 KPI 관리 애널리스트입니다.
전달된 KPI 데이터(사전 계산 지표)를 읽고 분석문을 작성하세요.

## 어조
- 차분하고 부드러운 어조로 씁니다. 과장되거나 공격적인 표현(예: "최악", "심각", "위기")은
  쓰지 마세요 — 사실과 숫자로 담담하게 전달하세요.
- 🔴🟡🟢 같은 신호등 색 이모지나 상태 아이콘은 쓰지 마세요.
- 데이터가 부족한 부분도 "이 부분은 함께 채워주시면 좋겠습니다"처럼 협조를 부탁하는
  투로 씁니다.

## 먼저 확인할 것 — 데이터 신뢰도 판정
전달된 "항목별_기재율"의 "판정" 필드를 그대로 신뢰하세요(이미 계산됨):
- "집계불가": 이 항목은 순위·비교·추세를 말하지 마세요. 표본이 대표성 없습니다.
- "참고용": 한쪽만 기재됨 — 참고 수치로만, 확정적 판단 금지.
- "분석가능": 정상 분석 대상.
"집계불가" 항목이 있으면 분석 맨 위에 "N개 항목은 기재가 아직 부족해 집계하기 어렵습니다"라고
부드럽게 안내하세요.

## 반드시 지킬 규칙
1. 실적 미기재를 "실적 0"으로 단정하지 마세요 — "미기재"와 "0 입력"은 다릅니다.
2. 코드충돌_건수가 0보다 크면 데이터 확인 요청에 포함하세요(서로 다른 PPT가 같은
   코드를 공유해 한쪽 데이터가 덮어써져 사라졌을 수 있음).
3. 숫자는 전달된 값만 쓰고 스스로 계산하지 마세요.
4. 숫자 없는 문장 금지. 모호한 헤지는 남발하지 말고 확인이 필요하면 구체적으로 짚어주세요.

## 출력 구조 (총 700자 이내)
1. **데이터 준비 상태** — 표 또는 목록, 집계가 어려운 항목 안내
2. **살펴본 항목** — "분석가능"/"참고용" 항목만, 기재율과 함께
3. **파트별 참여 현황** — 행수 기준, 아직 기재가 안 된 파트 안내
4. **함께 확인해주실 부분** — 코드충돌 등, 해당 파트에 확인 요청
없는 섹션은 "해당 없음"으로 짧게 표기.
"""


def get_kpi_analysis(force: bool = False) -> dict:
    df = K.get_kpi_df()
    data_key = str(K._kpi_cached_mtime)
    cache = _load_cache()
    entry = cache.get("kpi")
    if not force and entry and entry.get("data_key") == data_key:
        return entry

    metrics = _build_kpi_metrics()
    if not metrics:
        return {"text": "KPI 데이터가 없어 분석할 수 없습니다.", "generated_at": None, "data_key": data_key}

    user_message = "다음은 이번 회차 KPI 데이터의 사전 계산 지표입니다(JSON):\n" + \
        json.dumps(metrics, ensure_ascii=False, indent=2)
    text = _call_hchat(_KPI_SYSTEM_PROMPT, user_message)

    entry = {
        "text": text,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "data_key": data_key,
    }
    with _cache_lock:
        cache["kpi"] = entry
        _save_cache(cache)
    return entry


# ──────────────────────────────────────────────────────────────
# API
# ──────────────────────────────────────────────────────────────
@ai_bp.route("/api/ai/finance")
def api_ai_finance():
    force = request.args.get("force") == "1"
    try:
        return jsonify(get_finance_analysis(force))
    except Exception as e:
        logger.exception("경영실적 AI 분석 실패")
        return jsonify({"error": str(e)}), 502


@ai_bp.route("/api/ai/kpi")
def api_ai_kpi():
    force = request.args.get("force") == "1"
    try:
        return jsonify(get_kpi_analysis(force))
    except Exception as e:
        logger.exception("KPI AI 분석 실패")
        return jsonify({"error": str(e)}), 502
