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
import re
import threading
from datetime import datetime

import httpx
import pandas as pd
from dotenv import load_dotenv
from flask import Blueprint, jsonify, request

import performance as P
import kpi as K
import finance as F
import paths as _paths

load_dotenv()

logger = logging.getLogger(__name__)

ai_bp = Blueprint("ai", __name__)

# 파트명 앞 원문자(①~⑳) 제거 — performance.py _PART_PREFIX_RE와 동일 범위.
# AI가 서술할 때 번호까지 같이 읽어주면 불필요하게 딱딱해져서, 프롬프트에 넘기기 전에 벗겨낸다.
_PART_PREFIX_RE = re.compile(r"^[①-⑳]\s*")


def _strip_part_prefix(part: str) -> str:
    return _PART_PREFIX_RE.sub("", str(part)).strip()

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
            # 0.3은 "다시 분석"을 눌러도 데이터가 안 바뀌면 표현까지 거의 똑같이 나오게 만들던
            # 원인 중 하나 — 숫자는 프롬프트가 "전달된 값만 사용" 원칙으로 강하게 묶어두고 있어
            # 0.55 정도로는 숫자 왜곡 위험 없이 표현에만 자연스러운 변주를 줄 수 있음 (2026-09-21)
            "temperature": 0.55,
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
            "파트": _strip_part_prefix(part), "건수": int(len(g)),
            "계획_억": _round1(pl / 1e5), "누계_억": _round1(ac / 1e5), "연간추정_억": _round1(es / 1e5),
            "손익률_pct": _round1(g["operating_profit"].sum() / es * 100) if es > 0 else None,
            "경상이익_억": _round1((es - tc) / 1e5),
            "매출이익_억": _round1(g["profit_gross"].sum() / 1e5),
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
        "파트별": sorted(by_part, key=lambda r: (r["경상이익_억"] or 0), reverse=True),
        "사업구분별_손익률상하위": {"상위": biz_rows[:3], "하위": biz_rows[-3:]},
        "교육형태별_손익률상하위": {"상위": edu_rows[:3], "하위": edu_rows[-3:]},
        "계획누락_건수": int(len(noplan)), "계획누락_금액_억": _round1(noplan["jun_check_total"].sum() / 1e5),
        "미착수_건수": int(len(noact)), "미착수_계획액_억": _round1(noact["plan_initial"].sum() / 1e5),
        "미수주": _build_missed_bid_metrics(),
    }


def _build_missed_bid_metrics() -> list:
    """finance.py 재무 데이터에서 미수주 프로젝트 목록과 사유를 추출."""
    try:
        df = F.get_df()
        missed = df[df["note"].str.contains("[미수주]", na=False, regex=False)].copy()
        if missed.empty:
            return []
        result = []
        for _, row in missed.iterrows():
            note = str(row.get("note", "")).replace("[미수주]", "").replace("[미수주] :", "").strip(" :").strip()
            reason = str(row.get("missed_bid_reason", "")) if pd.notna(row.get("missed_bid_reason")) else ""
            result.append({
                "파트": _strip_part_prefix(str(row.get("part", "-"))),
                "매출_억": _round1(float(row.get("revenue", 0) or 0) / 1e8),
                "이익률_pct": _round1(float(row.get("profit_rate", 0) or 0)),
                "미수주사유": note[:120] if note else (reason[:120] if reason else "-"),
            })
        return result
    except Exception as e:
        logger.warning("미수주 데이터 추출 실패: %s", e)
        return []


_FINANCE_SYSTEM_PROMPT = """당신은 현대엔지비 기술교육 조직의 경영관리 수석 애널리스트입니다.
전달된 실적 지표(Python이 사전 계산)를 바탕으로, 팀장·경영진이 현황을 정확히 파악하고
다음 행동을 결정할 수 있도록 서술형 분석 보고서를 작성합니다.
보고서 제목은 **현대엔지비 기술교육 조직 경영실적 분석 보고서(참조용)** 으로 합니다.

## 핵심 원칙 — 반드시 준수
1. **숫자는 전달된 값만** 사용하세요. 직접 나눗셈·비율 재계산 절대 금지.
2. **달성률은 3개를 함께** 제시하세요: 단순달성률 / 안분달성률 / 연간전망률.
   안분기준선(경과월÷12×100)을 기준으로 페이스를 판정합니다.
   예: "단순달성률 45.2%는 기준선 66.7%에 못 미치지만, 안분 달성률은 67.8%로
   경과 기간 대비 정상 궤도입니다."
3. **경상이익과 매출이익을 구분**하세요. 경상이익은 모든 원가를 차감한 최종 손익이며,
   매출이익은 직접원가만 차감한 값입니다. 두 수치의 차이가 크면 간접비용 부담이 높다는 의미입니다.
4. **필요배수 2 이상** 파트는 "연말까지 남은 기간에 집중적인 관리가 필요한 파트"로
   명시하세요.
5. **비교 기준 없는 숫자 금지** — 반드시 계획/기준선/다른 파트와 비교해 의미를 부여하세요.
6. 이모지·신호등 아이콘 사용 금지. 강조는 **굵은 글씨**로만.
8. **정보가 부족하면 추측하지 마세요.** 판단하기 애매하거나 근거가 부족하면
   "자료만으로는 판단하기 어렵습니다"라고 명시하세요. 원인 추정 등 서술은 반드시 전달된
   데이터 안에서만 근거를 찾고, 학습된 일반 지식·업계 통념으로 채우지 마세요.
9. **건수(건수 필드)가 5건 미만인 파트는 순위·추세·다른 파트와의 비교를 하지 마세요.**
   건수를 반드시 함께 적고, 그 파트에 대해서는 개별 사실만 서술하세요
   (예: "K뉴딜TF는 3건으로 표본이 적어 추세 판단은 보류합니다").

## 어조 — 가장 중요한 원칙
**긍정적이고 발전 지향적인 시각**으로 작성합니다.
- 부진하거나 낮은 수치를 "나쁘다", "문제다"라고 단정하지 마세요. 대신 앞으로의 발전
  가능성을 중심으로, 어떻게 보완하면 더 나아질지를 서술하세요.
- 현재 잘 되고 있는 부분은 먼저 인정하고, 보완이 필요한 부분은 긍정적 전망과 함께
  언급하세요.
- 특정 연결어구나 문장 틀을 매번 반복해서 쓰지 마세요. 보고서마다 문장 구조·어미·표현을
  다르게 가져가세요 — 때로는 원인을 먼저 짚고 방향을 나중에 제시하거나, 때로는 방향
  제시를 먼저 하는 식으로 순서도 바꿔가며 쓰세요. 핵심은 "현황 인정 → 보완 방향 → 기대
  효과"라는 흐름이지, 문장의 정확한 형태가 아닙니다.
- "~입니다", "~됩니다" 형식의 간결한 경어체를 사용합니다.
- 이모지·신호등 아이콘은 쓰지 않습니다. 강조는 **굵은 글씨**로만.

## 출력 구조 (총 3,000자 이내. 마크다운 헤더·볼드·표 허용)

**[필수 준수] 문장 완결 원칙**
- 모든 문장은 반드시 완전한 문장으로 끝맺어야 합니다. "~입니다.", "~됩니다.", "~예상됩니다." 등 마침표로 완결하세요.
- 토큰 한도에 근접하더라도 마지막 문장을 중간에 끊지 마세요. 분량이 넘칠 것 같으면 앞 섹션을 간결하게 줄여 마지막 섹션까지 완결되게 작성하세요.
- 절대로 문장 중간에서 출력이 멈추어서는 안 됩니다.

**[필수 준수] 출력 전 최종 점검**
- 본문에 쓴 숫자가 모두 위 JSON 입력에 실제로 존재하는지 다시 확인하세요. 계산해서 만든
  숫자가 아니라 입력값 그대로인지 확인하세요.
- 원인·배경 서술에 입력 데이터에 없는 내용(추측·업계 통념)을 넣지 않았는지 확인하세요.
- 문제를 발견하면 그 문장을 고치거나 삭제한 뒤 최종 출력하세요.

### 1. 종합 현황 요약
**표 1개** — 아래 항목을 한눈에 볼 수 있도록 마크다운 표로 정리합니다:
| 구분 | 계획 | 누계실적 | 연간추정 | 단순달성률 | 안분달성률 | 연간전망률 |
(기준월, 안분기준선 수치를 표 아래 한 줄로 명시)
그 다음 **2~3문장 서술**로 전체 페이스를 긍정적으로 평가합니다.

### 2. 파트별 현황
**표 1개** — 각 파트의 핵심 지표를 요약합니다:
| 파트 | 연간추정(억) | 손익률(%) | 경상이익(억) | 매출이익(억) | 필요배수 |
표 아래에 다음 헬퍼 텍스트를 반드시 한 줄 추가하세요:
> ※ 경상이익 = 매출액 − 총원가(직접원가 + 인건비 + 공통원가 + 관리비) / 매출이익 = 매출액 − 직접원가
표 작성 후 **3~4문장 서술**로 잘 되고 있는 파트를 먼저 언급하고,
필요배수 2 이상 파트는 연말까지 집중 관리하면 만회 가능한 파트로 긍정적으로 표현합니다.

### 3. 수익성 분석
사업구분별·교육형태별 손익률 상·하위를 각각 **표 1개씩** 으로 요약합니다.
표 컬럼은 아래와 같이 구성하고, **"구분"(상위/하위 표시) 컬럼은 넣지 마세요**:
| 사업구분(또는 교육형태) | 건수 | 추정매출(억) | 손익률(%) |
상위 3개와 하위 3개는 하나의 표 안에 구분 없이 손익률 높은 순으로 나열합니다.
표 작성 후 **3~4문장 서술**로 강점 구조를 먼저 설명하고, 매출이익이 낮은 구분은
"원가 구조를 보완한다면 수익성이 더욱 향상될 것으로 기대됩니다"처럼 발전 가능성으로 서술합니다.

### 4. 미수주 프로젝트 분석
전달된 "미수주" 리스트를 바탕으로 분석합니다.
미수주가 0건이면 이 섹션은 "이번 집계 기간 미수주 프로젝트가 없습니다."로 한 줄만 표기하세요.
미수주가 있으면 **표 1개**로 먼저 정리합니다:
| 파트 | 매출규모(억) | 이익률(%) | 미수주 사유 요약 |
표 작성 후 **3~4문장 서술**로 미수주 사유의 공통 패턴, 파트별 특징,
향후 유사 입찰에서 보완할 수 있는 방향을 긍정적·발전적 시각으로 서술합니다.
사유 텍스트가 길면 핵심 키워드 중심으로 요약하세요.

### 5. 발전을 위한 제언
표 없이 **순수 서술형**으로만 작성합니다.
경영전문가 애널리스트 관점에서, 현재 잘 되고 있는 방향을 유지하면서
어떤 부분을 보완하면 더 좋은 성과로 이어질지를 이어지는 문장으로 서술합니다.
최대 5개 항목, 금액 영향이 큰 순서로.
각 항목은 "[대상] 현황 인정 → 보완 방향 → 기대되는 발전 효과"가 한 문단 안에 담기도록
쓰되, 문장 연결 방식은 항목마다 다르게 가져가세요(같은 어미·같은 연결어구 반복 금지).

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
    text = _call_hchat(_FINANCE_SYSTEM_PROMPT, user_message, max_tokens=4000)

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
    current_month = P._perf_current_month or 8

    # KPI 집계 요약 — kpi.py api_kpi_summary 내부 로직 재사용
    kpi_summary = []
    try:
        kpi_items = K._load_kpi_items_from_cache()
        targets          = K._aggregate_kpi_col(kpi_items, "PJ목표")
        actuals          = K._aggregate_kpi_col(kpi_items, "PJ실적")
        prevs            = K._aggregate_kpi_col(kpi_items, "PJ유사")
        avg_achieve_rates = K._compute_achieve_rates(kpi_items)

        result = []
        for i, kpi in enumerate(kpi_items):
            target = targets[i] if i < len(targets) else kpi["target"]
            actual = actuals[i] if i < len(actuals) else 0.0
            prev   = prevs[i]   if i < len(prevs)   else 0.0
            is_split = isinstance(kpi.get("target", 0), str) and "신규" in str(kpi.get("target", ""))

            if is_split:
                achieve = None
            elif not isinstance(target, str):
                t_num = float(target) if target else 0.0
                if kpi["agg"] == "sum":
                    achieve = round(float(actual) / t_num * 100, 1) if t_num else 0.0
                else:
                    achieve = avg_achieve_rates[i]
                    if achieve is None:
                        achieve = round(float(actual) / t_num * 100, 1) if t_num else 0.0
            else:
                achieve = None

            if is_split:
                t_new, t_old = K._parse_new_old_count(target)
                a_new, a_old = K._parse_new_old_count(actual)
                p_new, p_old = K._parse_new_old_count(prev)
                for suffix, t, a, p in (("신규", t_new, a_new, p_new), ("기존", t_old, a_old, p_old)):
                    # 연말 예상: sum 타입은 현재 페이스 연산
                    forecast = _round1(a / current_month * 12) if (t and a and kpi["agg"] == "sum") else None
                    result.append({
                        "KPI항목": kpi["name"].replace("신규/기존", suffix),
                        "사업계획목표": "-", "PPT목표": t, "실적": a, "전년유사": p,
                        "달성률_pct": round(a / t * 100, 1) if t else 0.0,
                        "연말예상": forecast,
                    })
                continue

            t_val = float(target) if not isinstance(target, str) else target
            forecast = None
            if kpi["agg"] == "sum" and not isinstance(t_val, str) and t_val and actual:
                forecast = _round1(float(actual) / current_month * 12)
            result.append({
                "KPI항목": kpi["name"],
                "사업계획목표": "-",
                "PPT목표": t_val, "실적": actual, "전년유사": prev,
                "달성률_pct": achieve,
                "연말예상": forecast,
            })

        for idx, row in enumerate(result):
            row["사업계획목표"] = K._PLAN_TARGETS[idx] if idx < len(K._PLAN_TARGETS) else "-"

        kpi_summary = result
    except Exception as e:
        logger.warning("KPI 집계 요약 생성 실패: %s", e)

    by_part = []
    if "파트명" in df.columns:
        for part, g in df.groupby("파트명"):
            by_part.append({"파트": _strip_part_prefix(part), "프로젝트수": int(len(g))})

    return {
        "기준월": current_month,
        "전체행수": total_rows,
        "KPI집계": kpi_summary,
        "파트별_현황": by_part,
    }


_KPI_SYSTEM_PROMPT = """당신은 현대차그룹 기술교육 조직의 KPI 경영관리 수석 애널리스트입니다.
전달된 KPI 집계 지표(Python이 사전 계산)를 바탕으로, 팀장·경영진이 현황을 정확히 파악하고
다음 행동을 결정할 수 있도록 서술형 분석 보고서를 작성합니다.

## 핵심 원칙 — 반드시 준수
1. **숫자는 전달된 값만** 사용하세요. 직접 나눗셈·비율 재계산 절대 금지.
2. **달성률 해석**: 사업계획목표 대비 실적, PPT목표 대비 실적을 구분해서 언급하세요.
   두 목표가 다를 경우 그 차이가 중요한 발견입니다.
3. **연말예상(연말예상 필드)**은 "현재 월 기준 페이스로 연말에 예상되는 수치"입니다.
   이것과 사업계획목표를 비교해 달성 가능성을 판단하세요.
4. **전년유사 비교**: 전년 동기 대비 개선·후퇴를 반드시 언급하세요.
5. 이모지·신호등 아이콘 사용 금지. 강조는 **굵은 글씨**로만.
6. 비교 기준 없는 숫자 금지 — 반드시 목표/전년/기준선 중 하나와 비교해 의미를 부여하세요.
7. **정보가 부족하면 추측하지 마세요.** 판단하기 애매하거나 근거가 부족하면
   "자료만으로는 판단하기 어렵습니다"라고 명시하세요. 원인 추정 등 서술은 반드시 전달된
   데이터 안에서만 근거를 찾고, 학습된 일반 지식·업계 통념으로 채우지 마세요.
8. **파트별_현황의 프로젝트수가 5건 미만인 파트는 순위·비교를 하지 마세요.** 건수를
   반드시 함께 적고, 그 파트에 대해서는 개별 사실만 서술하세요.

## 어조 — 가장 중요한 원칙
**긍정적이고 발전 지향적인 시각**으로 작성합니다.
- 달성률이 낮거나 미달인 항목을 "나쁘다", "문제다"라고 단정하지 마세요. 대신 앞으로의
  발전 가능성을 중심으로, 어떻게 보완하면 더 나아질지를 서술하세요.
- 이미 목표를 초과한 항목은 성과를 충분히 인정하고, 보완이 필요한 항목은 긍정적 전망으로
  연결하세요.
- 특정 연결어구나 문장 틀을 매번 반복해서 쓰지 마세요. 보고서마다 문장 구조·어미·표현을
  다르게 가져가세요 — 핵심은 "현황 인정 → 보완 방향 → 기대 효과"라는 흐름이지, 문장의
  정확한 형태가 아닙니다.
- "~입니다", "~됩니다" 형식의 간결한 경어체를 사용합니다.
- 이모지·신호등 아이콘은 쓰지 않습니다. 강조는 **굵은 글씨**로만.

## 출력 구조 (총 3,000자 이내. 마크다운 헤더·볼드·표 허용)

**[필수 준수] 문장 완결 원칙**
- 모든 문장은 반드시 완전한 문장으로 끝맺어야 합니다. "~입니다.", "~됩니다.", "~예상됩니다." 등 마침표로 완결하세요.
- 토큰 한도에 근접하더라도 마지막 문장을 중간에 끊지 마세요. 분량이 넘칠 것 같으면 앞 섹션을 간결하게 줄여 마지막 섹션까지 완결되게 작성하세요.
- 절대로 문장 중간에서 출력이 멈추어서는 안 됩니다.

**[필수 준수] 출력 전 최종 점검**
- 본문에 쓴 숫자가 모두 위 JSON 입력에 실제로 존재하는지 다시 확인하세요. 계산해서 만든
  숫자가 아니라 입력값 그대로인지 확인하세요.
- 원인·배경 서술에 입력 데이터에 없는 내용(추측·업계 통념)을 넣지 않았는지 확인하세요.
- 문제를 발견하면 그 문장을 고치거나 삭제한 뒤 최종 출력하세요.

### 1. KPI 종합 현황
**표 1개** — 전체 KPI 항목을 한눈에 정리합니다:
| KPI 항목 | 사업계획목표 | 실적 | 달성률(%) | 전년유사 | 연말예상 |
표 아래 **3~4문장 서술**로 전반적인 달성 수준과 긍정적인 특징을 먼저 평가합니다.

### 2. 파트별 참여 현황
**표 1개** — 파트별 프로젝트 수를 정리합니다.
표 아래 **2~3문장 서술**로 파트별 참여 분포를 긍정적으로 설명합니다.

### 3. 항목별 심층 분석
표 없이 **순수 서술형**으로 작성합니다.
이미 목표를 달성하거나 근접한 항목을 먼저 언급하고, 전년 대비 개선된 부분을 강조합니다.
PPT목표와 사업계획목표의 괴리가 있는 항목은 목표 설정을 정교화했을 때의 관리 효과를
발전 방향으로 서술합니다. (4~5문장)

### 4. 연말 예상 전망
표 없이 **순수 서술형**으로 작성합니다.
"연말예상" 값을 활용해 현재 페이스가 유지될 경우 연말 착지를 전망합니다.
목표 달성이 유력한 항목의 긍정적 전망을 먼저 서술하고,
추가 노력이 필요한 항목은 가능성 중심으로 표현합니다. (4~5문장)

### 5. 발전을 위한 제언
표 없이 **순수 서술형**으로 작성합니다.
현재 잘 되고 있는 방향을 유지하면서 어떤 부분을 보완하면 더 좋은 성과로 이어질지를
이어지는 문장으로 서술합니다. 최대 4개 항목, 문장 연결 방식은 항목마다 다르게 가져가세요
(같은 어미·같은 연결어구 반복 금지).
각 항목은 "[대상 KPI/파트] 현황 → 보완 방향 → 기대되는 발전 효과"가 한 문단에 담기도록,
"~를 강화한다면 ~로 발전할 수 있습니다", "~하면 ~할 것으로 예상됩니다" 형식으로 씁니다.
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
    text = _call_hchat(_KPI_SYSTEM_PROMPT, user_message, max_tokens=4000)

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
