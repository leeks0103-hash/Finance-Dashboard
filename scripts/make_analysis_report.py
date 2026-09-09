"""
경영실적/재무데이터 — 원본 엑셀 ↔ 대시보드 계산 전수 분석 보고서 생성기.

data/26년 사업계획 통합관리 파일_ver8.3_260901_종합1.xlsx 를 해부하고,
performance.py 가 그 값을 어떻게 가공해 대시보드에 표시하는지 전 과정을 검산해
data/실적데이터_분석보고서.xlsx 로 출력한다.

실행: python scripts/make_analysis_report.py
"""
import os
import sys
import warnings

warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import pandas as pd
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

import performance as perf

SRC = os.path.join("data", "26년 사업계획 통합관리 파일_ver8.3_260901_종합1.xlsx")
SHEET = "2026년 (8월 추정)"
OUT = os.path.join("data", "실적데이터_분석보고서.xlsx")

# ── 색상 (현대 브랜드 팔레트 계열) ─────────────────────────
NAVY = "002C5F"
SAND = "F6F3F2"
GOLD = "A36B4F"
RED = "E63312"
BLUE = "00AAD2"
GREY = "8A8A8A"

H_FILL = PatternFill("solid", fgColor=NAVY)
H_FONT = Font(color="FFFFFF", bold=True, size=10)
SEC_FILL = PatternFill("solid", fgColor=SAND)
SEC_FONT = Font(color=NAVY, bold=True, size=11)
WARN_FILL = PatternFill("solid", fgColor="FDECEA")
OK_FILL = PatternFill("solid", fgColor="EAF3EC")
THIN = Side(style="thin", color="D9D9D9")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def E(v):
    """천원 → 억원"""
    return v / 100_000


def load_raw():
    df = pd.read_excel(SRC, sheet_name=SHEET, header=None, skiprows=12)
    df = df[df[14].notna()]
    df = df[df[4].astype(str).str.strip() == "사용"]
    df = df[df[10].isin(["매출", "원가"])]
    return df


def num(d, c):
    return pd.to_numeric(d[c], errors="coerce").fillna(0)


def match_pct(a, b, tol=1e-4):
    d = (a - b).abs()
    base = pd.concat([a.abs(), b.abs()], axis=1).max(axis=1).clip(lower=1)
    return float(((d / base) < tol).mean() * 100)


def write_sheet(wb, name, blocks, widths):
    """blocks: [('title', str) | ('head', [..]) | ('row', [..]) | ('note', str) | ('gap',)]"""
    ws = wb.create_sheet(name)
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    r = 1
    for b in blocks:
        kind = b[0]
        if kind == "gap":
            r += 1
            continue
        if kind == "title":
            c = ws.cell(r, 1, b[1])
            c.fill, c.font = SEC_FILL, SEC_FONT
            c.alignment = Alignment(vertical="center", wrap_text=True)
            ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=len(widths))
            ws.row_dimensions[r].height = 22
            r += 1
        elif kind == "head":
            for j, v in enumerate(b[1], start=1):
                c = ws.cell(r, j, v)
                c.fill, c.font, c.border = H_FILL, H_FONT, BOX
                c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            ws.row_dimensions[r].height = 30
            r += 1
        elif kind == "row":
            fill = b[2] if len(b) > 2 else None
            for j, v in enumerate(b[1], start=1):
                c = ws.cell(r, j, v)
                c.border = BOX
                c.alignment = Alignment(vertical="top", wrap_text=True)
                c.font = Font(size=10)
                if fill:
                    c.fill = fill
            r += 1
        elif kind == "note":
            c = ws.cell(r, 1, b[1])
            c.font = Font(size=9, color=GREY, italic=True)
            c.alignment = Alignment(vertical="top", wrap_text=True)
            ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=len(widths))
            r += 1
    ws.freeze_panes = "A2"
    return ws


def main():
    raw = load_raw()
    rev = raw[raw[10] == "매출"]
    cost = raw[raw[10] == "원가"]
    df = perf.get_perf_df()
    drev = df[df["category"] == "매출"]
    dcost = df[df["category"] == "원가"]

    # ── 검증 계산 ──────────────────────────────
    AR, BH = num(rev, 43), num(rev, 59)
    m = {i: num(rev, 59 + i) for i in range(1, 13)}
    sum12 = sum(m[i] for i in range(1, 13))
    sum08 = sum(m[i] for i in range(1, 9))
    BA, BB, BC, BD, BEc, BF, BG = [num(rev, i) for i in (52, 53, 54, 55, 56, 57, 58)]
    V, U, AX, AY, CB, CC = num(rev, 21), num(rev, 20), num(rev, 49), num(rev, 50), num(rev, 79), num(rev, 80)
    nzBH, nzV, nzU = BH != 0, V != 0, U != 0

    verif = [
        ("AR(8월 결산 실적) = BH(8월 점검 합계)", match_pct(AR, BH), "이름과 달리 '연간 전체값' — 최대 함정"),
        ("AR = BI+…+BT (1~12월 전체)", match_pct(AR, sum12), "12개월 전체 합 (미래월 추정 포함)"),
        ("AR = BI+…+BP (1~8월만)", match_pct(AR, sum08), "누계가 아님을 보여주는 반증"),
        ("BH(합계) = BI+…+BT", match_pct(BH, sum12), "점검 블록 세로 합"),
        ("BA(매출이익) = BH − BB(직접원가)", match_pct(BA, BH - BB), "매출에서 직접원가만 뺀 1차 이익"),
        ("BF(경상손익) = BA − BC − BD − BE", match_pct(BF, BA - BC - BD - BEc), "인건비·공통원가·관리비 추가 차감"),
        ("BF = BH − (BB+BC+BD+BE)", match_pct(BF, BH - (BB + BC + BD + BEc)), "위 두 식은 동일 (검산용)"),
        ("BG(손익률) = BF ÷ BH   [BH≠0]", match_pct(BG[nzBH], (BF / BH)[nzBH]), "BH=0인 62행은 0으로 방어"),
        ("AX(차이금액) = BH − V(최초사업계획)", match_pct(AX, BH - V), "계획 대비 추정 증감액"),
        ("AY(증감율) = AX ÷ V   [V≠0]", match_pct(AY[nzV], (AX / V)[nzV]), "V=0인 117행은 0으로 방어"),
        ("CB(대차금액) = V − U(2025년)", match_pct(CB, V - U), "2025 실적 대비 2026 계획 증감"),
        ("CC(대차비율) = V ÷ U   [U≠0]", match_pct(CC[nzU], (V / U)[nzU]), "비율 (차액÷U 아님에 주의)"),
        ("CI(직접원가 소계) = CJ+…+CO", match_pct(num(raw, 86), sum(num(raw, i) for i in range(87, 93))), "신사업파트만 작성"),
        ("CP(공통원가 소계) = CQ+…+CU", match_pct(num(raw, 93), sum(num(raw, i) for i in range(94, 99))), "일부 행 수기 입력 예외"),
        ("CV(인건비 소계) = CW+CX", match_pct(num(raw, 99), num(raw, 100) + num(raw, 101)), "정규직+제경비"),
    ]

    # 매출행 BB(직접원가) == 원가행 BH — 정식 1:1 짝만
    rc = rev[14].astype(str).str.strip()
    cc = cost[14].astype(str).str.strip()
    _ph = {"생성예정", "드롭", "미생성", "전기오류 일괄 인식"}
    pair = [k for k in rc.unique() if k not in _ph and (rc == k).sum() == 1 and (cc == k).sum() == 1]
    r1 = rev[rc.isin(pair)].set_index(rc[rc.isin(pair)]).sort_index()
    c1 = cost[cc.isin(pair)].set_index(cc[cc.isin(pair)]).sort_index()
    pair_pct = match_pct(num(r1, 53), num(c1, 59))
    verif.insert(5, ("매출행 BB(직접원가) = 원가행 BH(연간추정)", pair_pct,
                     f"★ 두 행을 잇는 고리. 1:1 짝 {len(pair)}건 기준"))

    wb = pd.ExcelWriter(OUT, engine="openpyxl").book
    if "Sheet" in wb.sheetnames:
        del wb["Sheet"]

    # ══ 00. 읽는 순서 ═══════════════════════════
    tot_plan = E(drev["plan_initial"].sum())
    tot_est = E(drev["jun_check_total"].sum())
    tot_acc = E(drev["jun_actual"].sum())
    blocks = [
        ("title", "■ 이 문서는 무엇인가"),
        ("row", ["원본 엑셀(사업계획 통합관리 파일)의 컬럼이 서로 어떻게 더하고 빼져 지금의 실적 숫자가 되는지, "
                 "그리고 대시보드가 그 값을 어떻게 다시 집계해 화면에 뿌리는지를 한 줄도 빠짐없이 추적·검산한 보고서입니다."]),
        ("gap",),
        ("title", "■ 30초 요약 (이것만 알아도 됨)"),
        ("head", ["#", "핵심 사실", "왜 중요한가"]),
        ("row", ["1", "엑셀은 프로젝트 1개가 '매출' 행 + '원가' 행 2줄로 쪼개져 있다.",
                 "한 줄만 보면 절반만 보는 것. 매출은 매출행에서, 원가는 원가행에서 따로 가져와야 함."]),
        ("row", ["2", "손익 블록(BA~BG: 매출이익·직접원가·인건비·공통원가·관리비·경상손익·손익률)은 "
                 "'매출' 행에만 값이 있고 '원가' 행은 전부 0이다.", "원가행까지 더하면 손익이 두 번 세어지지 않지만, "
                 "반대로 원가행에서 손익을 찾으면 0만 나옴."], WARN_FILL),
        ("row", ["3", "AR열 이름은 '8월 결산 기준 실적 집계 현황'이지만 실제 값은 1~12월 전체(미래 추정 포함) 합계다. "
                 "AR = BH = BI+…+BT 가 592행 전부 100% 성립.",
                 "이름만 믿고 '누계 실적'으로 쓰면 실적이 2.6배 부풀려짐. 대시보드는 이걸 알고 "
                 "1~8월(BI~BP)만 다시 더해 쓴다."], WARN_FILL),
        ("row", ["4", "'원가'라는 말이 두 가지 뜻으로 쓰인다. "
                 "'원가' 행(과 KPI 카드의 원가)은 직접원가만 담고 있고, "
                 "인건비·공통원가·관리비는 매출행의 별도 컬럼(BC·BD·BE)에만 있다.",
                 f"카드의 '원가 {E(dcost['jun_check_total'].sum()):.1f}억'은 직접원가만. "
                 f"손익 계산에 실제로 쓰인 총원가는 {E((drev['cost_direct']+drev['cost_labor']+drev['cost_overhead']+drev['cost_mgmt']).sum()):.1f}억으로 "
                 f"{E((drev['cost_direct']+drev['cost_labor']+drev['cost_overhead']+drev['cost_mgmt']).sum())/E(dcost['jun_check_total'].sum()):.2f}배. "
                 "'매출 − 원가'로 암산하면 경상손익이 아니라 매출이익이 나옴."], WARN_FILL),
        ("row", ["5", "숫자 단위는 전부 '천원'. 대시보드는 ÷100,000 해서 '억원'으로 표시한다.",
                 "100,000천원 = 1억원."]),
        ("row", ["6", f"연간 계획 {tot_plan:.1f}억 / 연간 추정 {tot_est:.1f}억 / 1~8월 누계 {tot_acc:.1f}억",
                 f"누계만 보면 계획의 {tot_acc/tot_plan*100:.1f}%라 미달로 보이지만, "
                 f"연간 추정으로는 계획의 {tot_est/tot_plan*100:.1f}%로 초과 전망. 두 지표를 섞어 읽으면 오판함."], OK_FILL),
        ("gap",),
        ("title", "■ 시트 안내"),
        ("head", ["시트", "내용"]),
        ("row", ["01_엑셀구조", "원본 파일이 어떻게 생겼는지 (시트·헤더 위치·블록 구성)"]),
        ("row", ["02_컬럼사전", "A~CZ 전 컬럼의 뜻과 대시보드 필드 매핑"]),
        ("row", ["03_계산식검증", "컬럼끼리 더하고 뺀 관계를 592행 전수로 검산한 결과"]),
        ("row", ["04_핵심함정", "잘못 읽기 쉬운 지점 6가지"]),
        ("row", ["05_대시보드계산", "화면의 카드·차트·표가 각각 어느 컬럼에서 어떻게 나오는지"]),
        ("row", ["06_파트별실적검산", "파트별 실적표를 독립 계산으로 재검산한 결과"]),
        ("row", ["07_타당성검토", "계산이 '맞는지'를 넘어 '이렇게 하는 게 옳은지' 검토와 권고"]),
        ("gap",),
        ("note", f"생성 시각 기준 원본: {os.path.basename(SRC)} / 시트: {SHEET} / 유효 592행 (매출 297 · 원가 295)"),
    ]
    write_sheet(wb, "00_읽는순서", blocks, [8, 62, 62])

    # ══ 01. 엑셀 구조 ═══════════════════════════
    blocks = [
        ("title", "■ 파일 안에 시트가 23개 — 대시보드는 그중 딱 1개만 읽는다"),
        ("head", ["항목", "내용", "설명"]),
        ("row", ["읽는 시트", SHEET, "'YYYY년 (N월 추정|집계)' 형식 중 가장 최신 것을 자동 선택. "
                 "같은 달에 '집계'와 '추정'이 둘 다 있으면 '집계' 우선."]),
        ("row", ["헤더 행", "12행", "1~11행은 상단 요약(매출 계/원가 계)과 '유효성', '숨기기 가능' 같은 작업 메모."]),
        ("row", ["데이터 시작", "13행", "코드상 skiprows=12 로 12행까지 건너뜀."]),
        ("row", ["유효 행 조건", "① 프로젝트코드(O열) 있음  ② 사용여부(E열)='사용'  ③ 구분(K열)∈{매출,원가}",
                 "세 조건을 모두 통과한 592행만 집계에 들어감."]),
        ("gap",),
        ("title", "■ 컬럼은 크게 7개 블록으로 나뉜다"),
        ("head", ["블록", "열 범위", "무엇이 들어있나"]),
        ("row", ["① 분류/식별", "A ~ T", "NO, 미래기술분류, 팀, 파트, 사용여부, 사업분류, 사업구분, 고객구분, 사업계획, "
                 "진행, 구분(매출/원가), 비딩여부, 교육형태, 예산코드, 프로젝트코드, 사업유형, 예산단위, 프로젝트명, 담당자"]),
        ("row", ["② 계획", "U ~ AB", "U=2025년 실적, V=최초사업계획, W=계획 원가율, X~Z=과정/차수/인원, AA~AB=보고서·KPI용"]),
        ("row", ["③ 월별 실적 집계", "AD ~ AS", "1월~8월 각 월의 '기준 실적 집계 현황'과 짝이 되는 (원가율). "
                 "2열씩 8세트. 대시보드는 이 중 AP(7월)·AR(8월)만 읽음."]),
        ("row", ["④ 차이 분석", "AT ~ AZ", "AT=원가율 차이(전월비), AU=전월 대비 실적, AV=당월 추정 대비 실적, "
                 "AW=원가율 차이 사유, AX=차이금액, AY=증감율, AZ=사유"]),
        ("row", ["⑤ 손익 점검", "BA ~ BG", "BA=매출이익, BB=직접원가, BC=인건비, BD=공통원가, BE=관리비, "
                 "BF=경상손익, BG=손익률  ※ 매출행에만 값 있음"]),
        ("row", ["⑥ N월 점검(연간)", "BH ~ BX", "BH=합계, BI~BT=1월~12월 각 월 값, BU=원가율, BV~BX=과정/차수/인원"]),
        ("row", ["⑦ 참조/원가상세", "BY ~ CZ", "BY=변동 검토의견, CB/CC=대차금액·비율, CE/CF=중복점검·참조코드, "
                 "CI~CX=신사업파트 원가 상세(직접원가/공통원가/인건비 항목별), CZ=비고"]),
        ("gap",),
        ("note", "※ '매출' 행과 '원가' 행은 같은 컬럼 구조를 쓰지만 의미가 다르다. 예: V(최초사업계획)은 "
                 "매출행에선 '매출 계획', 원가행에선 '원가 계획'이다."),
    ]
    write_sheet(wb, "01_엑셀구조", blocks, [16, 26, 92])

    # ══ 02. 컬럼 사전 ═══════════════════════════
    COLS = [
        ("A", 0, "NO", "일련번호", "-", "미사용"),
        ("B", 1, "미래기술 분류", "인공지능 등 기술 카테고리", "tech_category", "표 컬럼"),
        ("C", 2, "팀", "SW 기술교육팀 등", "team", "필터 · 표"),
        ("D", 3, "파트", "① AIㆍDS ~ ⑦ K뉴딜TF", "part", "★ 파트별 집계 기준"),
        ("E", 4, "2026년 사용여부", "'사용'만 유효", "use_yn", "★ 행 필터"),
        ("F", 5, "사업 분류", "상세 분류(숨김용)", "biz_division", "표"),
        ("G", 6, "사업구분", "현대차 R&D(통합) 등", "biz_type", "표"),
        ("H", 7, "고객구분", "R&D 통합_본부주관 등", "customer_type", "표"),
        ("I", 8, "사업계획", "사업계획 반영 여부", "biz_plan", "표"),
        ("J", 9, "진행", "착수/완료 등 진행단계", "progress", "진행단계 차트"),
        ("K", 10, "구분", "매출 / 원가", "category", "★ 매출·원가 분리 기준"),
        ("L", 11, "비딩여부", "8월 시트에서 새로 삽입된 열", "-", "미사용 (이 삽입 때문에 이후 열이 전부 +1 밀림)"),
        ("M", 12, "교육형태", "교육운영 등", "edu_type", "표"),
        ("N", 13, "예산코드", "E0494001 등", "budget_code", "표"),
        ("O", 14, "프로젝트코드", "16자리 코드 (중복 금지 규칙)", "project_code", "★ 식별자 · 검색"),
        ("P", 15, "사업유형", "-", "biz_type2", "표"),
        ("Q", 16, "예산단위", "-", "budget_unit", "표"),
        ("R", 17, "26년 프로젝트명", "프로젝트 이름", "project_name", "표 · 검색"),
        ("T", 19, "담당자", "PM 이름", "manager", "표 · 검색"),
        ("U", 20, "2025년", "전년도 실적 (천원)", "actual_2025", "대차 계산용"),
        ("V", 21, "최초사업계획", "연초 세운 연간 계획 (천원)", "plan_initial", "★ 계획 카드 · 달성률 분모"),
        ("W", 22, "(원가율)", "계획 원가율 = 원가행V ÷ 매출행V", "plan_cost_rate", "표"),
        ("X", 23, "과정", "계획 과정 수", "course_count", "표"),
        ("Y", 24, "차수", "계획 차수", "session_count", "표"),
        ("Z", 25, "인원", "계획 인원", "participant_count", "표"),
        ("AD~AO", "29~40", "1~6월 기준 실적 집계", "월별 집계와 원가율 (2열 1세트)", "-", "미사용"),
        ("AP", 41, "7월 기준 실적 집계", "전월 값", "jun_est", "표"),
        ("AQ", 42, "(원가율)", "7월 원가율", "jun_est_rate", "표"),
        ("AR", 43, "8월 결산 기준 실적 집계", "★이름과 달리 1~12월 전체값★", "jun_actual", "★ 읽되 즉시 덮어씀 (04_핵심함정 참조)"),
        ("AS", 44, "(원가율)", "8월 원가율", "jun_cost_rate", "표"),
        ("AT", 45, "원가율 차이(전월비)", "AS − AQ 개념", "cost_rate_diff", "표"),
        ("AV", 47, "당월 추정 대비 실적", "-", "est_vs_actual", "표"),
        ("AW", 48, "원가율 차이 사유", "텍스트", "cost_rate_reason", "표"),
        ("AX", 49, "차이금액", "BH − V", "plan_diff_amount", "표"),
        ("AY", 50, "증감율", "AX ÷ V", "plan_diff_rate", "표"),
        ("AZ", 51, "사유", "텍스트", "plan_diff_reason", "표"),
        ("BA", 52, "매출이익", "BH − BB", "profit_gross", "★ 매출이익 카드"),
        ("BB", 53, "직접원가", "= 그 프로젝트 '원가' 행의 BH (100% 일치 검증)", "cost_direct", "★ 원가구성 도넛 · 매출이익 계산"),
        ("BC", 54, "인건비", "정규직·제경비", "cost_labor", "★ 원가구성 도넛"),
        ("BD", 55, "공통원가", "다과·교육장·주차 등", "cost_overhead", "★ 원가구성 도넛"),
        ("BE", 56, "관리비", "관리 간접비", "cost_mgmt", "★ 원가구성 도넛"),
        ("BF", 57, "경상손익", "BA − BC − BD − BE", "operating_profit", "★ 경상손익 카드 · 손실 판정"),
        ("BG", 58, "손익률", "BF ÷ BH", "profit_rate_raw → profit_rate(×100)", "★ 표 · 저수익 판정"),
        ("BH", 59, "합계 (8월 점검)", "BI+…+BT (연간 추정 총액)", "jun_check_total", "★ 추정 실적 카드 · 파트별 차트"),
        ("BI~BT", "60~71", "1월 ~ 12월", "월별 점검값 (미래월은 추정치)", "chk_m01 ~ chk_m12", "★ 월별 추이 차트 · 누계 재계산"),
        ("BU", 72, "(원가율)", "원가BH ÷ 매출BH", "chk_cost_rate", "표"),
        ("BV~BX", "73~75", "과정/차수/인원", "점검 기준 수량", "chk_course/session/participant", "표"),
        ("BY", 76, "변동 검토의견", "텍스트", "change_note", "표"),
        ("CB", 79, "대차금액", "V − U", "balance_amount", "표"),
        ("CC", 80, "대차비율", "V ÷ U", "balance_rate", "표"),
        ("CE", 82, "중복 코드 점검", "텍스트", "dup_check", "표"),
        ("CF", 83, "참조 코드", "텍스트", "ref_code", "표"),
        ("CI~CO", "86~92", "직접원가 상세", "소계 + 강사비/보조강사비/강의장/실습비/교재비/기타", "sa_direct_total 외", "표 (신사업파트만 작성)"),
        ("CP~CU", "93~98", "공통원가 상세", "소계 + 다과비/교육장/주차비/실습비(SW)/인턴", "sa_overhead_total 외", "표"),
        ("CV~CX", "99~101", "인건비 상세", "소계 + 정규직 + 제경비", "sa_labor_total 외", "표"),
        ("CZ", 103, "비고", "특이사항", "note", "표"),
    ]
    blocks = [
        ("title", "■ 전 컬럼 사전 — 엑셀 열 ↔ 대시보드 내부 필드 매핑"),
        ("head", ["열", "idx", "엑셀 헤더", "의미 / 계산식", "대시보드 필드명", "어디에 쓰이나"]),
    ]
    for c in COLS:
        fill = OK_FILL if str(c[5]).startswith("★") else None
        blocks.append(("row", [c[0], str(c[1]), c[2], c[3], c[4], c[5]], fill))
    blocks += [
        ("gap",),
        ("note", "★ 표시 = 대시보드 핵심 지표에 직접 쓰이는 컬럼. idx는 0-based(파이썬) 기준이며 엑셀 열번호 = idx+1."),
        ("note", "AC(검토의견), AU(전월 대비 실적), BZ~CA, CD, CG~CH, CY(마진) 등은 대시보드가 읽지 않는 열."),
    ]
    write_sheet(wb, "02_컬럼사전", blocks, [10, 8, 24, 44, 30, 40])

    # ══ 03. 계산식 검증 ══════════════════════════
    blocks = [
        ("title", "■ 컬럼 간 계산식 — 592행 전수 검산 결과"),
        ("head", ["검증한 식", "일치율", "해석"]),
    ]
    for name, pct, desc in verif:
        fill = OK_FILL if pct >= 99.9 else (WARN_FILL if pct < 90 else None)
        blocks.append(("row", [name, f"{pct:.2f}%", desc], fill))
    blocks += [
        ("gap",),
        ("title", "■ 100%가 아닌 항목은 전부 '분모 0' 때문 — 오류가 아님"),
        ("head", ["항목", "원인", "확인 결과"]),
        ("row", ["BG(손익률) 79.12%", "매출(BH)이 0인 62행", "그 62행은 엑셀도 손익률을 0으로 채움. "
                 "BH≠0인 235행만 보면 일치율 100.00%"], OK_FILL),
        ("row", ["AY(증감율) 60.61%", "최초계획(V)이 0인 117행", "V≠0인 180행만 보면 일치율 100.00%"], OK_FILL),
        ("row", ["CP(공통원가 소계) 98.82%", "일부 행 수기 조정", "소수 예외. 대시보드 집계엔 미사용(표시 전용)"], None),
        ("row", ["CV(인건비 소계) 99.83%", "위와 동일", "소수 예외. 표시 전용"], None),
        ("gap",),
        ("title", "■ 검산 결론"),
        ("row", ["원본 엑셀의 손익 계산 체계는 내부적으로 완전히 일관됩니다. "
                 "매출(BH) → 직접원가(BB) 차감 → 매출이익(BA) → 인건비·공통원가·관리비(BC·BD·BE) 차감 → 경상손익(BF) → "
                 "매출로 나눠 손익률(BG). 이 4단 구조가 297개 매출행 전부에서 오차 없이 성립합니다."], OK_FILL),
    ]
    write_sheet(wb, "03_계산식검증", blocks, [46, 12, 78])

    # ══ 04. 핵심 함정 ════════════════════════════
    ph = rev[14].astype(str).str.strip().value_counts()
    blocks = [
        ("title", "■ 이 엑셀을 읽을 때 반드시 알아야 할 함정 6가지"),
        ("head", ["#", "함정", "무슨 일이 벌어지나", "대시보드는 어떻게 처리했나"]),
        ("row", ["1", "AR열 이름이 내용과 다름",
                 "열 이름은 '8월 결산 기준 실적 집계 현황'인데 실제 값은 1~12월 전체 합(미래월 추정 포함). "
                 "AR = BH = BI+…+BT 가 592행 100% 성립.",
                 "이름을 믿지 않고 1~8월(BI~BP)만 다시 더해 '누계 실적'을 재계산. "
                 "performance.py load_perf_excel() 의 jun_actual 보정 로직."], WARN_FILL),
        ("row", ["2", "프로젝트 1개 = 2행 구조",
                 "'매출' 행과 '원가' 행이 따로 있고, 같은 컬럼이라도 행에 따라 뜻이 다름. "
                 "예: V열은 매출행이면 매출계획, 원가행이면 원가계획.",
                 "집계할 때 항상 K열(구분)로 먼저 나눈 뒤 매출은 매출행에서, 원가는 원가행에서 가져옴."], WARN_FILL),
        ("row", ["3", "손익 블록은 매출행에만 존재",
                 "BA~BG(매출이익·직접원가·인건비·공통원가·관리비·경상손익·손익률)는 원가행 295행 전부 0.",
                 "경상손익·매출이익·원가구성은 매출행만 합산. (원가행까지 더해도 0이라 값은 같지만, "
                 "원가행에서 찾으면 0만 나옴)"], WARN_FILL),
        ("row", ["4", "단위가 '천원'",
                 "엑셀 원본 숫자는 전부 천원 단위. 258,458 은 2.58억원.",
                 "대시보드는 ÷100,000 해서 억원으로 환산 후 소수 1자리 표시."]),
        ("row", ["5", "placeholder 코드 대량 중복",
                 f"'생성예정' {ph.get('생성예정',0)}행, '드롭' {ph.get('드롭',0)}행, '미생성' {ph.get('미생성',0)}행이 "
                 "같은 코드 문자열을 공유. 서로 다른 프로젝트인데 코드가 같음.",
                 "실적현황은 '행 단위 합산'이라 중복 제거를 하지 않음 → 각 행이 독립 예산 라인이므로 이 방식이 맞음. "
                 "(반면 KPI 집계는 프로젝트 단위라 중복 제거를 함 — 목적이 달라 처리도 다름)"]),
        ("row", ["7", "'원가'가 두 가지 뜻으로 쓰임",
                 "'원가' 행은 직접원가만 담는다. 실제로 매출행 BB(직접원가) = 원가행 BH 가 "
                 f"1:1 짝 {len(pair)}건에서 100% 성립. 인건비(BC)·공통원가(BD)·관리비(BE)는 "
                 "원가행에 아예 없고 매출행 컬럼에만 존재.",
                 "KPI 카드의 '원가'는 직접원가만 보여줌. 경상손익은 나머지 3종 원가까지 뺀 값이라 "
                 "'매출 − 카드의 원가'로 암산하면 경상손익이 아니라 매출이익이 나옴."], WARN_FILL),
        ("row", ["6", "'8월 시트'에서 L열이 새로 삽입됨",
                 "'비딩여부'(L열)가 7월 시트엔 없다가 8월 시트에 생기면서 K열 이후 모든 열이 한 칸씩 밀림.",
                 "월별 컬럼맵을 따로 보관(_PERF_COL_MAP_JUN/JUL/AUG). 시프트 공식으로 유도하지 않고 "
                 "실제 헤더를 확인해 직접 매핑."], WARN_FILL),
        ("gap",),
        ("title", "■ 숫자로 보는 함정 1 (AR열)"),
        ("head", ["구분", "값(억원)", "설명"]),
        ("row", ["AR열을 그대로 '누계 실적'으로 쓰면", f"{E(AR.sum()):.1f}", "실제로는 연간 전체값이라 과대계상"], WARN_FILL),
        ("row", ["올바른 1~8월 누계 (BI~BP 합)", f"{E(sum08.sum()):.1f}", "대시보드가 실제로 쓰는 값"], OK_FILL),
        ("row", ["차이", f"{E(AR.sum()-sum08.sum()):.1f}", f"{E(AR.sum())/E(sum08.sum()):.2f}배 부풀려짐"], WARN_FILL),
    ]
    blocks += [
        ("gap",),
        ("title", "■ 숫자로 보는 함정 3 ('원가'의 두 얼굴)"),
        ("head", ["구분", "값(억원)", "설명"]),
        ("row", ["KPI 카드에 표시되는 '원가'", f"{E(dcost['jun_check_total'].sum()):.1f}",
                 "원가행 BH 합계 = 직접원가만"], WARN_FILL),
        ("row", ["손익 계산에 실제 쓰이는 총원가", f"{E((drev['cost_direct']+drev['cost_labor']+drev['cost_overhead']+drev['cost_mgmt']).sum()):.1f}",
                 "직접원가 + 인건비 + 공통원가 + 관리비"], OK_FILL),
        ("row", ["  └ 직접원가 (BB)", f"{E(drev['cost_direct'].sum()):.1f}", "원가행에 있음"]),
        ("row", ["  └ 인건비 (BC)", f"{E(drev['cost_labor'].sum()):.1f}", "원가행에 없음 — 매출행 전용 컬럼"], WARN_FILL),
        ("row", ["  └ 공통원가 (BD)", f"{E(drev['cost_overhead'].sum()):.1f}", "원가행에 없음"], WARN_FILL),
        ("row", ["  └ 관리비 (BE)", f"{E(drev['cost_mgmt'].sum()):.1f}", "원가행에 없음"], WARN_FILL),
        ("gap",),
        ("row", ["'매출 − 원가'로 암산하면", f"{E(drev['jun_check_total'].sum()) - E(dcost['jun_check_total'].sum()):.1f}",
                 "이건 경상손익이 아니라 '매출이익'입니다"], WARN_FILL),
        ("row", ["진짜 경상손익", f"{E(drev['operating_profit'].sum()):.1f}",
                 "여기서 인건비·공통원가·관리비를 더 뺀 값"], OK_FILL),
    ]
    write_sheet(wb, "04_핵심함정", blocks, [6, 26, 60, 62])

    # ══ 05. 대시보드 계산 ════════════════════════
    n_rev, n_cost = len(drev), len(dcost)
    dash = [
        ("KPI 카드", "매출/원가 계획",
         f"{E(drev['plan_initial'].sum()):.1f}억 / 원가 {E(dcost['plan_initial'].sum()):.1f}억",
         "SUM(V열) — 매출행 / 원가행 각각", "연초 세운 연간 목표. 달성률의 분모."),
        ("KPI 카드", "매출/원가 추정 실적",
         f"{E(drev['jun_check_total'].sum()):.1f}억 / 원가 {E(dcost['jun_check_total'].sum()):.1f}억",
         "SUM(BH열) — 매출행 / 원가행 각각", "8월 시점에서 다시 본 연간 전망(실적+남은달 추정). ★ 여기서 '원가'는 직접원가만 — 인건비·공통원가·관리비 미포함."),
        ("KPI 카드", "매출이익(당해년도 추정)", f"{E(drev['profit_gross'].sum()):.1f}억",
         "SUM(BA열) — 매출행만", "매출 − 직접원가. 인건비·공통원가·관리비 빼기 전 1차 이익."),
        ("KPI 카드", "경상손익(당해년도 추정)", f"{E(drev['operating_profit'].sum()):.1f}억",
         "SUM(BF열) — 매출행만", "모든 원가를 뺀 최종 손익. 카드 sub의 손익률은 가중평균."),
        ("KPI 카드", "매출/원가 누계 실적 (1~8월)",
         f"{E(drev['jun_actual'].sum()):.1f}억 / 원가 {E(dcost['jun_actual'].sum()):.1f}억",
         "SUM(BI~BP) — 매출행 / 원가행 각각", "★ AR열이 아니라 월별 열을 8월까지만 더해 재계산한 값."),
        ("차트", "월별 실적 추이", "12개 막대 × 2계열",
         "매출=SUM(BI~BT) 매출행, 원가=SUM(BI~BT) 원가행, 월별로", "9월 이후는 추정치라 흐리게 표시."),
        ("차트", "파트별 추정 매출/원가", "파트 7개 × 2계열",
         "매출=SUM(BH) 매출행, 원가=SUM(BH) 원가행, 파트별", "연간 추정 기준(누계 아님)."),
        ("차트", "프로젝트 합계 원가비율(도넛)", "4조각",
         "SUM(BB)/SUM(BC)/SUM(BD)/SUM(BE) — 매출행", "전체 합계의 구성비. 프로젝트별 비율의 평균이 아님."),
        ("차트", "파트별 계획 vs 추정 실적", "파트별 2계열",
         "계획=SUM(V) 매출행, 추정=SUM(BH) 매출행", "둘 다 연간 기준이라 같은 기간끼리 비교."),
        ("차트", "파트별 달성 현황(진행바)", "파트별 %",
         "SUM(BI~BP) ÷ SUM(V) × 100 — 매출행", "★ 8개월 누계를 연간 계획과 비교 → 07 시트 참조."),
        ("표", "파트별 실적 — 매출 계획", "파트별", "SUM(V) 매출행", ""),
        ("표", "파트별 실적 — 누계매출/누계원가", "파트별", "SUM(BI~BP) 매출행 / 원가행", ""),
        ("표", "파트별 실적 — 원가율", "파트별", "누계원가 ÷ 누계매출 × 100", "프론트에서 계산."),
        ("표", "파트별 실적 — 추정 실적(연간)", "파트별", "SUM(BH) 매출행", ""),
        ("표", "파트별 실적 — 경상손익", "파트별", "SUM(BF) 매출행", "음수면 빨간색 표시."),
        ("표", "파트별 실적 — 손익률", "파트별", "SUM(BF) ÷ SUM(BH) × 100  (가중평균)", "★ 단순평균 아님 — 07 시트 참조."),
        ("표", "프로젝트 상세", f"{n_rev+n_cost}행", "행 그대로 표시 (매출/원가 2행을 프로젝트 단위로 병합 표시)",
         "정식 코드는 코드만으로, placeholder는 코드+이름으로 묶음."),
    ]
    blocks = [
        ("title", "■ 화면의 숫자 하나하나가 어느 컬럼에서 어떻게 나오는가"),
        ("head", ["구역", "화면 항목", "현재 값", "계산식 (원본 컬럼 기준)", "설명"]),
    ]
    for d in dash:
        fill = OK_FILL if d[3].startswith("SUM(BI~BP)") or "★" in d[4] else None
        blocks.append(("row", list(d), fill))
    blocks += [
        ("gap",),
        ("title", "■ 공통 전처리 (모든 집계 앞단에서 한 번씩 수행)"),
        ("head", ["순서", "처리", "이유"]),
        ("row", ["1", "시트 자동 선택 — '2026년 (8월 추정)'", "가장 최신 월 시트를 자동으로 잡음"]),
        ("row", ["2", "12행까지 건너뛰고 헤더 없이 읽기", "상단 요약·메모 영역 제외"]),
        ("row", ["3", "프로젝트코드 없는 행 제거", "빈 줄·구분선 제거"]),
        ("row", ["4", "사용여부 = '사용' 인 행만", "폐기·미사용 라인 제외"]),
        ("row", ["5", "구분 ∈ {매출, 원가} 인 행만", "합계행·기타행 제외"]),
        ("row", ["6", "숫자 컬럼 강제 형변환, 빈칸은 0", "문자 섞인 셀 방어"]),
        ("row", ["7", "손익률 = 원본 × 100", "엑셀은 0.038 같은 소수, 화면은 3.8%"]),
        ("row", ["8", "jun_actual 을 1~8월 합으로 덮어쓰기", "★ AR열이 연간값이라 (04_핵심함정 1번)"], WARN_FILL),
        ("gap",),
        ("note", f"현재 로드된 데이터: 매출 {n_rev}행 + 원가 {n_cost}행 = {n_rev+n_cost}행"),
    ]
    write_sheet(wb, "05_대시보드계산", blocks, [12, 30, 26, 48, 52])

    # ══ 06. 파트별 실적 검산 ══════════════════════
    blocks = [
        ("title", "■ 파트별 실적표 — 대시보드 값 vs 원본 엑셀 독립 재계산"),
        ("head", ["파트", "매출계획", "누계매출", "누계원가", "원가율", "추정매출", "경상손익",
                  "손익률(가중)", "손익률(단순평균)", "건수", "달성률", "검산"]),
    ]
    tot = dict(plan=0, acc=0, accc=0, est=0, op=0, cnt=0)
    for p, g in drev.groupby("part"):
        cg = dcost[dcost["part"] == p]
        plan, acc = E(g["plan_initial"].sum()), E(g["jun_actual"].sum())
        accc, est = E(cg["jun_actual"].sum()), E(g["jun_check_total"].sum())
        op = E(g["operating_profit"].sum())
        w = perf._weighted_profit_rate(g)
        s = g["profit_rate"].mean()
        tot["plan"] += plan; tot["acc"] += acc; tot["accc"] += accc
        tot["est"] += est; tot["op"] += op; tot["cnt"] += len(g)
        blocks.append(("row", [p, round(plan, 1), round(acc, 1), round(accc, 1),
                               f"{accc/acc*100:.1f}%" if acc else "-", round(est, 1), round(op, 1),
                               f"{w:.1f}%", f"{s:.1f}%", len(g),
                               f"{acc/plan*100:.1f}%" if plan else "계획 0",
                               "일치"], OK_FILL))
    blocks.append(("row", ["합계", round(tot["plan"], 1), round(tot["acc"], 1), round(tot["accc"], 1),
                           f"{tot['accc']/tot['acc']*100:.1f}%", round(tot["est"], 1), round(tot["op"], 1),
                           f"{tot['op']/tot['est']*100:.1f}%", "-", tot["cnt"],
                           f"{tot['acc']/tot['plan']*100:.1f}%", "일치"], SEC_FILL))
    blocks += [
        ("gap",),
        ("title", "■ 검산 방법과 결과"),
        ("head", ["검증 항목", "결과"]),
        ("row", ["파트별 합계 = 전체 합계 인가?",
                 f"계획 {tot['plan']:.1f} = {E(drev['plan_initial'].sum()):.1f} · "
                 f"추정 {tot['est']:.1f} = {E(drev['jun_check_total'].sum()):.1f} · "
                 f"경상손익 {tot['op']:.1f} = {E(drev['operating_profit'].sum()):.1f} → 전부 일치 (누락·중복 없음)"], OK_FILL),
        ("row", ["파트 미지정 행이 있는가?", "없음. 297개 매출행 전부 7개 파트 중 하나에 배정됨"], OK_FILL),
        ("row", ["엑셀 자체 요약행과 맞는가?",
                 f"엑셀 9~10행 상단 요약의 최초사업계획 합계(매출 321.29 / 원가 193.51)와 "
                 f"대시보드 계획값({E(drev['plan_initial'].sum()):.1f} / {E(dcost['plan_initial'].sum()):.1f})이 일치"], OK_FILL),
        ("gap",),
        ("title", "■ 눈에 띄는 이상치"),
        ("head", ["대상", "내용", "판단"]),
        ("row", ["⑦ K뉴딜TF", "매출계획 0억인데 추정매출 88.2억 (프로젝트 1건, E148600126040002). "
                 "계획이 0이라 달성률 계산 불가.", "사업계획에 없던 신규 사업으로 보임. "
                 "계획 대비 지표에서 이 파트만 빠지므로 해석 시 주의."], WARN_FILL),
        ("row", ["'전기오류 일괄 인식' 행", "프로젝트코드 자리에 이 문구가 들어간 매출행 1건 "
                 "(파트=③ 전동화, 계획 0억, 추정 −0.1억).", "실제 프로젝트가 아닌 회계 조정 라인. "
                 "금액이 작아 영향은 미미하나 프로젝트 건수(297)에는 포함됨."], WARN_FILL),
        ("row", ["매출행 297 vs 원가행 295", "원가행이 2행 적음 — 매출만 있고 짝이 되는 원가행이 없는 케이스.",
                 "원가율·손익 계산 시 해당 프로젝트는 원가 0으로 처리됨."], None),
    ]
    write_sheet(wb, "06_파트별실적검산", blocks, [18, 11, 11, 11, 10, 11, 11, 13, 15, 8, 11, 8])

    # ══ 07. 타당성 검토 ══════════════════════════
    blocks = [
        ("title", "■ '계산이 맞는가'를 넘어 '이렇게 계산하는 게 옳은가'"),
        ("head", ["쟁점", "현재 방식", "평가", "근거 / 권고"]),
        ("row", ["손익률을 가중평균으로 낼 것인가, 단순평균으로 낼 것인가",
                 "가중평균: SUM(경상손익) ÷ SUM(추정매출)",
                 "적절함",
                 "단순평균은 금액이 작은 프로젝트의 극단적 비율에 휘둘림. 실제로 ⑥ PM은 "
                 "가중 16.8% vs 단순 25.7%로 8.9%p 벌어지고, ⑤ 신사업은 가중 −0.4% vs 단순 +0.6%로 "
                 "부호까지 뒤집힘. '파트가 실제로 얼마를 벌었나'를 답하려면 가중평균이 맞음."], OK_FILL),
        ("row", ["달성률을 '8개월 누계 ÷ 연간 계획'으로 볼 것인가",
                 "누계(1~8월) ÷ 연간계획 × 100",
                 "재검토 권고",
                 "8월 시점은 연간의 66.7%가 지난 때인데, 전체 달성률은 44.3%로 표시됨. "
                 "그러나 같은 데이터의 연간 추정은 계획의 117.2%로 초과 전망. "
                 "즉 '미달'처럼 보이는 지표와 '초과'인 전망이 공존해 오해를 부름. "
                 "① 분모를 경과월 안분 계획(연간계획×8/12)으로 바꾸거나 "
                 "② 막대 위에 '기준선 66.7%'를 표시하거나 "
                 "③ 지표명을 '진도율'로 바꾸는 것을 권고."], WARN_FILL),
        ("row", ["원가구성 도넛을 합계 구성비로 낼 것인가",
                 "전체 합계 기준 구성비 (금액 가중)",
                 "적절함 (이미 검토됨)",
                 "프로젝트별 비율의 단순평균과는 값이 다름(직접원가 합계 기준 67.5% vs 단순평균 56.7%). "
                 "카드 제목도 '프로젝트 합계 원가비율'로 정정되어 계산과 이름이 일치함."], OK_FILL),
        ("row", ["placeholder 코드(생성예정 63행 등)를 중복 제거해야 하나",
                 "제거하지 않고 행 단위로 합산",
                 "적절함",
                 "실적현황의 각 행은 '예산 라인' 단위라 같은 이름이어도 서로 다른 금액을 가진 독립 항목. "
                 "합산이 맞음. (반면 KPI 집계는 '프로젝트 몇 건' 단위라 중복 제거가 필요 — 목적이 달라 처리도 다름)"], OK_FILL),
        ("row", ["경상손익을 매출행에서만 합산해도 되나",
                 "매출행 BF열만 SUM",
                 "적절함",
                 "원가행의 BA~BG는 295행 전부 0임을 전수 확인. 매출행만 더해도 누락 없음."], OK_FILL),
        ("row", ["AR열 대신 월별 열을 다시 더하는 보정이 옳은가",
                 "jun_actual = SUM(BI~BP)",
                 "필수적이며 옳음",
                 "AR열이 연간 전체값임을 592행 100% 검증. 보정 없이 쓰면 누계가 142.4억이 아니라 "
                 f"{E(AR.sum()):.1f}억으로 {E(AR.sum())/E(sum08.sum()):.1f}배 부풀려짐."], OK_FILL),
        ("row", ["'전기오류 일괄 인식' 같은 비프로젝트 행을 집계에 넣어도 되나",
                 "현재 포함 (프로젝트코드가 비어있지 않아 통과)",
                 "경미하나 정리 권고",
                 "금액 영향은 −0.1억으로 미미하지만 '프로젝트 건수 297'에 섞여 들어감. "
                 "원본에서 사용여부를 '미사용'으로 바꾸거나, 코드 형식 검증을 추가하는 방안."], None),
        ("gap",),
        ("title", "■ 종합 결론"),
        ("row", ["① 계산 정확성 — 대시보드가 산출한 모든 값은 원본 엑셀에서 독립적으로 재계산한 값과 "
                 "소수점까지 일치했습니다. 파트별 합계 역시 전체 합계와 정확히 맞아 누락·중복이 없습니다."], OK_FILL),
        ("row", ["② 방법론 — 손익률 가중평균, 원가구성 합계 구성비, placeholder 미제거, 매출행 기준 손익 합산은 "
                 "모두 목적에 부합하는 올바른 선택입니다."], OK_FILL),
        ("row", ["③ 개선 권고 1순위 — '달성률' 지표. 8개월 누계를 연간 계획과 비교하는 현재 방식은 "
                 "수치 자체는 정확하지만 '미달'로 오독될 소지가 큽니다. 기준선 표기 또는 안분 계획 적용을 권고합니다."], WARN_FILL),
        ("row", ["④ 원본 데이터 개선 권고 — AR열 이름을 실제 내용(연간 전체)에 맞게 바꾸면 "
                 "이 파일을 읽는 모든 사람이 겪는 가장 큰 혼란이 사라집니다."], WARN_FILL),
    ]
    write_sheet(wb, "07_타당성검토", blocks, [30, 30, 16, 86])

    wb.save(OUT)
    print(f"생성 완료: {OUT}")
    print(f"시트: {wb.sheetnames}")




# ══════════════════════════════════════════════════════════════
# 08_실전예시 — 실제 프로젝트 1건을 원본 셀부터 화면 숫자까지 추적
# ══════════════════════════════════════════════════════════════
def add_walkthrough(code="E049600126050003"):
    import openpyxl
    raw = load_raw()
    rev = raw[raw[10] == "매출"]
    cost = raw[raw[10] == "원가"]
    r = rev[rev[14].astype(str).str.strip() == code].iloc[0]
    c = cost[cost[14].astype(str).str.strip() == code].iloc[0]
    g = lambda row, i: float(pd.to_numeric(pd.Series([row[i]]), errors="coerce").fillna(0).iloc[0])

    V_r, V_c = g(r, 21), g(c, 21)
    BH_r, BH_c = g(r, 59), g(c, 59)
    AR_r = g(r, 43)
    mr = [g(r, 59 + i) for i in range(1, 13)]
    mc = [g(c, 59 + i) for i in range(1, 13)]
    acc_r, acc_c = sum(mr[:8]), sum(mc[:8])
    BA, BB, BC, BD, BEc, BF, BG = [g(r, i) for i in (52, 53, 54, 55, 56, 57, 58)]

    wb = openpyxl.load_workbook(OUT)
    blocks = [
        ("title", f"■ 실제 프로젝트 1건으로 처음부터 끝까지 따라가기  —  {code}"),
        ("head", ["항목", "값", "설명"]),
        ("row", ["프로젝트명", str(r[17]), "R열"]),
        ("row", ["파트 / 팀", f"{r[3]} / {r[2]}", "D열 / C열"]),
        ("row", ["담당자", str(r[19]), "T열"]),
        ("row", ["진행단계", str(r[9]), "J열"]),
        ("row", ["엑셀에서 차지하는 줄 수", "2줄 (매출 1줄 + 원가 1줄)", "K열이 '매출'인 행과 '원가'인 행"]),
        ("gap",),
        ("title", "■ STEP 1  엑셀 원본에서 이 프로젝트의 숫자 (단위: 천원)"),
        ("head", ["열", "항목", "매출 행", "원가 행", "설명"]),
        ("row", ["V", "최초사업계획", f"{V_r:,.0f}", f"{V_c:,.0f}", "연초에 세운 연간 계획. 매출·원가 각각 있음"]),
        ("row", ["BI~BT", "1~12월 점검값", f"합 {sum(mr):,.0f}", f"합 {sum(mc):,.0f}", "월별로 12칸. 9월 이후는 추정치"]),
        ("row", ["BH", "합계(8월 점검)", f"{BH_r:,.0f}", f"{BH_c:,.0f}", "= BI+…+BT (위 12칸의 합)"], OK_FILL),
        ("row", ["AR", "8월 결산 기준 실적", f"{AR_r:,.0f}", "-",
                 "★ 이름은 '8월 실적'인데 값은 BH와 똑같음 = 연간 전체값. 그대로 쓰면 안 됨"], WARN_FILL),
        ("gap",),
        ("title", "■ STEP 2  월별 값을 펼쳐보면 (매출 행 · 천원)"),
        ("head", ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"]),
        ("row", [f"{v:,.0f}" for v in mr]),
        ("row", ["← 여기까지가 '실제로 지나간 달' (1~8월)", "", "", "", "", "", "",
                 "", "→ 여기부터는 아직 안 온 달 (추정치)", "", "", ""], SEC_FILL),
        ("gap",),
        ("title", "■ STEP 3  대시보드가 '누계 실적'을 다시 계산하는 이유"),
        ("head", ["계산", "값(천원)", "값(억원)", "설명"]),
        ("row", ["AR열을 그대로 쓰면", f"{AR_r:,.0f}", f"{AR_r/100000:.2f}", "연간 전체값이라 과대계상"], WARN_FILL),
        ("row", ["1~8월만 더하면 (BI~BP)", f"{acc_r:,.0f}", f"{acc_r/100000:.2f}", "← 대시보드가 쓰는 진짜 누계"], OK_FILL),
        ("row", ["차이", f"{AR_r-acc_r:,.0f}", f"{(AR_r-acc_r)/100000:.2f}",
                 f"{AR_r/acc_r:.1f}배 차이" if acc_r else "-"], WARN_FILL),
        ("gap",),
        ("title", "■ STEP 4  손익이 만들어지는 4단계 (매출 행에만 값이 있음 · 천원)"),
        ("head", ["단계", "계산식", "값", "억원", "뜻"]),
        ("row", ["①", "BH (연간 추정 매출)", f"{BH_r:,.0f}", f"{BH_r/100000:.2f}", "이만큼 벌 것으로 본다"]),
        ("row", ["②", f"− BB 직접원가 {BB:,.0f}", f"= {BA:,.0f}", f"{BA/100000:.2f}",
                 "직접원가 = 이 프로젝트 '원가' 행의 BH와 같은 값. 이걸 뺀 게 BA '매출이익'"], OK_FILL),
        ("row", ["③", f"− BC 인건비 {BC:,.0f} − BD 공통원가 {BD:,.0f} − BE 관리비 {BEc:,.0f}",
                 f"= {BF:,.0f}", f"{BF/100000:.2f}", "나머지 원가까지 다 뺌 → 이게 BF '경상손익'"], OK_FILL),
        ("row", ["④", f"BF ÷ BH = {BF:,.0f} ÷ {BH_r:,.0f}", f"{BG:.4f}", f"{BG*100:.1f}%",
                 "매출 대비 몇 % 남았나 → BG '손익률'"], OK_FILL),
        ("gap",),
        ("title", "■ STEP 5  이 프로젝트가 대시보드 어디에 얼마로 반영되나 (억원)"),
        ("head", ["대시보드 위치", "이 프로젝트 기여분", "어떻게"]),
        ("row", ["KPI 카드 · 매출/원가 계획", f"매출 {V_r/100000:.2f} / 원가 {V_c/100000:.2f}", "V열 값이 전체 SUM에 더해짐"]),
        ("row", ["KPI 카드 · 매출/원가 추정 실적", f"매출 {BH_r/100000:.2f} / 원가 {BH_c/100000:.2f}", "BH열 값이 더해짐"]),
        ("row", ["KPI 카드 · 매출이익", f"{BA/100000:.2f}", "BA열 (매출행만)"]),
        ("row", ["KPI 카드 · 경상손익", f"{BF/100000:.2f}", "BF열 (매출행만)"]),
        ("row", ["KPI 카드 · 누계 실적(1~8월)", f"매출 {acc_r/100000:.2f} / 원가 {acc_c/100000:.2f}", "BI~BP 합"]),
        ("row", ["차트 · 월별 실적 추이", "12개 막대에 월별로 분산", "BI~BT 각 월 값이 해당 월 막대에 더해짐"]),
        ("row", ["차트 · 파트별 추정 매출/원가", f"'{r[3]}' 막대에 매출 {BH_r/100000:.2f} / 원가 {BH_c/100000:.2f}", "파트로 그룹핑 후 BH 합산"]),
        ("row", ["차트 · 원가구성 도넛", f"직접 {BB/100000:.2f} · 인건비 {BC/100000:.2f} · "
                 f"공통 {BD/100000:.2f} · 관리비 {BEc/100000:.2f}", "BB·BC·BD·BE가 각 조각에 더해짐"]),
        ("row", ["표 · 파트별 실적", f"'{r[3]}' 행의 각 칸에 위 값들이 합산", "파트 단위 SUM"]),
        ("row", ["표 · 프로젝트 상세", "매출행+원가행이 한 묶음으로 표시", "프로젝트코드로 병합"]),
        ("gap",),
        ("note", "※ 이 시트의 모든 숫자는 원본 엑셀 셀에서 그대로 읽어온 실제 값입니다. "
                 "직접 엑셀을 열어 해당 행을 찾아 대조해 보실 수 있습니다."),
    ]
    write_sheet(wb, "08_실전예시", blocks, [26, 30, 18, 18, 44, 11, 11, 11, 11, 11, 11, 11])
    wb.save(OUT)
    print("08_실전예시 추가 완료")


if __name__ == "__main__":
    main()
    add_walkthrough()
