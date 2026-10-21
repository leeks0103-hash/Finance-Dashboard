# 경영현황 통합 대시보드

기술교육실 프로젝트의 경영실적·재무 이력·KPI를 한 화면에서 보는 내부용 대시보드.
원본은 전부 엑셀/PPT — DB 없이 PC 한 대에서 Flask + React로 돌림.

---

## 화면

| 탭 | 데이터 | 주요 내용 |
|----|--------|----------|
| **경영실적/재무데이터** (`/#/performance`) | 사업계획 통합관리 파일(엑셀) + 재무 PPT 추출본 | KPI 카드, 월별·파트별 차트, 원가 비율 도넛, 미수주 프로젝트, 프로젝트 상세(행 더블클릭 → 재무 이력) |
| **KPI/경영현황** (`/#/kpi`) | KPI PPT 추출본 | 목표 vs 실적 차트, KPI 집계, KPI 취합(목록/상세) |

- 차트 막대·도넛 조각 클릭 → 그 값을 만든 프로젝트 목록(산출 근거)
- 헤더 "!" = 데이터 이상(코드 충돌·불일치·완료보고 이상), 관리자에겐 노란 "!" = PPT 업데이트 요청
- ⚙ 설정: 주간/야간, 그래프 수치(G), 표 금액 원 단위(W), 재무 대조(F), 차트 색상, 사용방법(투어)
- ⚙ > 관리자 기능: PPT 추출(증분·선택·초기화), 추출 현황, 실적 파일 반영, 공개 범위, 재무 불일치 목록

---

## 데이터 흐름

```
재무·KPI : NAS PPT 보고서 → scripts/extract_*_ppt.py → data/*.xlsx → Flask(finance.py·kpi.py) → React
실적현황 : 사업계획 통합관리 파일 엑셀 → data/에 넣기만 → Flask(performance.py + perf_autoupdate.py) → React
```

| 데이터 | 파일 (`data/`) | 단위 |
|--------|---------------|------|
| 재무 | `재무관점 필수 데이터 추출.xlsx` (시트 `취합`) | 원 |
| KPI | `KPI 지표 데이터 추출.xlsx` | - |
| 실적 | `*사업계획 통합관리 파일*.xlsx` (월마다 새 파일) | 천원 |

- 계산은 전부 백엔드, 프론트는 단위 변환·표시만
- 여러 사람이 공유하는 설정(공개 범위·요청·수정 완료 표시 등)은 `data/*.json`에 저장 — 브라우저마다 따로가 아니라 모두 같은 값

---

## 실행

처음 한 번:
```bash
pip install -r requirements.txt
cd frontend && npm install
```
`.env.example` → `.env`로 복사 후 계정(`ADMIN_ACCOUNTS`·`USER_ACCOUNTS`)·H-chat 키 채움.

평소:
```bash
python dashboard_manager.py --start   # 또는 dashboard_start.bat
```
- 백엔드 `http://localhost:5000`, 화면 `http://localhost:5188`
- 다른 PC는 `http://<이 PC IP>:5188`로 접속 — 화면은 각자 브라우저, 데이터는 전부 이 PC에서 처리
- `.py` 코드를 바꾸면 Flask 재시작 필요. `/api/*/reload`는 엑셀만 다시 읽음

---

## 데이터 업데이트

**실적** — 새 파일을 `data/`에 넣거나 관리자 기능 창에 끌어다 놓으면 끝
- 파일명 날짜(`_yymmdd_`) 최신 파일 → 최신 시트(`YYYY년 (N월 집계|추정)`, 같은 달이면 집계 우선)
- 열이 밀려도 머리글 대조로 자동 매핑 → 계산식 검증(95% 이상) 통과해야 반영
- 실패하면 직전 파일 그대로 보이고 이유는 관리자 기능 창에

**재무·KPI** — ⚙ > 관리자 기능 > PPT 추출
- 증분: 바뀐 파일만 / 선택: 고른 파일만 다시(기존 행 지우고 새로) / 초기화: 전부 다시
- 원본은 NAS(`paths.PPT_SOURCE_DIR`) 고정, 결과는 로컬 `data/`

---

## 숫자 규칙 (바꾸면 원본과 어긋남)

- 실적 금액 천원 → 억 = ÷100,000 / 재무 금액 원 → 억 = ÷1억
- 실적 누계는 1~기준월만 다시 더함 — 원본 "N월 실적" 열은 이름과 달리 1~12월 전체(미래 추정 포함)
- 기준월 = 읽은 시트의 N월(달력으로 짐작 안 함)
- "매출 − 원가"는 매출이익. 원가행 = 직접원가만, 경상손익 = 매출이익 − 인건비 − 공통원가 − 관리비
- 손익률 평균은 가중평균(Σ경상손익 ÷ Σ매출), 행별 단순평균 금지
- 진행률 = 누계 매출 ÷ 연간 추정 매출
- KPI 집계는 정식 코드만, 같은 프로젝트는 가장 진행된 단계 1건만. 항목명에 건수·매출액 있으면 합계, 아니면 평균

자세한 건 `CLAUDE.md` "데이터 규칙".

---

## 주의

- ⚠️ **NAS(`\\10.206.32.3\기술교육팀`) 파일은 읽기만** — 수정·삭제 절대 금지. NAS PPT를 PowerPoint로 직접 열지 말 것(DRM이 원본을 다시 암호화한 적 있음)
- 결과 엑셀(`data/*.xlsx`)을 Excel로 열지 말 것 — AIP 레이블이 붙으면 못 읽음. 재무 0건이면 이것부터 의심
- `data/`의 엑셀·json, `.env`는 git 제외 — 비밀번호 커밋 금지

---

## 폴더

```
dashboard/
├── app.py                 Flask 앱 — 블루프린트, 로그인 검사, 추출 실행, 공개 범위·데이터 이상 API
├── performance.py         실적 읽기·집계·상세·엑셀 다운로드
├── perf_autoupdate.py     새 실적 파일 열 맞추기·계산식 검증
├── finance.py / kpi.py    재무·KPI 엑셀 읽기·집계
├── extract_requests.py    PPT 업데이트 요청
├── paths.py               데이터 경로·실적 파일 고르기
├── auth.py / shared.py / downloads.py / ai_insight.py / perf_export.py / extract_coverage.py
├── scripts/               PPT 추출, check_perf_headers.py, fill_user_accounts.py 등
├── data/                  엑셀·상태 json (git 제외)
├── frontend/src/          React — types → utils → api → store → hooks → viewmodels → ui → features → pages
└── docs/                  session-log(작업 기록), api-spec, data-schema, known-issues
```

## 기술 스택

- 백엔드: Python · Flask · pandas · openpyxl · waitress · H-chat(사내 LLM)
- 프론트: Vite · React 19 · TypeScript · Zustand · TanStack Query/Table · Chart.js

## Git

`https://github.com/leeks0103-hash/Finance-Dashboard.git` (`main`) — 커밋 메시지는 한국어
