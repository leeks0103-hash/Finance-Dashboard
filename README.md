# 프로젝트 재무 대시보드

기술교육사업기획팀에서 쓰는 프로젝트 재무 현황 대시보드입니다.
PPT 보고서에서 자동으로 데이터를 뽑아서, 한 화면에서 전체 재무 흐름을 바로 파악할 수 있게 만들었어요.

---

## 이게 뭐 하는 건가요?

각 파트에서 제출하는 PPT 보고서가 있는데, 거기서 매출·지출·이익율 같은 숫자를 자동으로 뽑아서 엑셀로 저장합니다. 이 대시보드는 그 엑셀을 읽어서 실시간으로 보여주는 역할이에요.

```
PPT 보고서 (파트별) 
  → Python 추출 스크립트 (특정 슬라이드의 차트/표만 파싱)
  → 엑셀 파일 2종 저장
      - 재무관점 필수 데이터 추출.xlsx  ← 이 대시보드가 읽는 파일
      - KPI 지표 데이터 추출.xlsx
  → Flask API 서버
  → React 대시보드
```

---

## 주요 기능

- **KPI 카드** — 총매출 / 지출합계 / 경상이익 / 평균 이익율을 한눈에
- **파트별 차트** — 이익율 막대 / 매출-지출 비교 / 원가 구성 도넛
- **재무 인사이트** — 이익율 상위 프로젝트, 저수익·손실 프로젝트 자동 분류
- **전체 테이블** — 75개 프로젝트 상세 (검색·정렬·컬럼 ON/OFF·페이지네이션)
- **필터** — 연도 / 파트 / 보고단계별 필터링 (실시간 반영)
- **CSV / PDF 내보내기** — 필터 상태 그대로 다운로드
- **다크 / 라이트 모드** — 설정 패널에서 바로 전환

---

## 기술 스택

### 백엔드
| | |
|---|---|
| 언어·프레임워크 | Python 3, Flask |
| 데이터 처리 | pandas, openpyxl |
| PDF 생성 | reportlab |
| 서버 | waitress (운영), Flask dev (개발) |

### 프론트엔드
| | |
|---|---|
| 빌드 | Vite + TypeScript |
| UI | React 19 |
| 상태 관리 | Zustand (필터, 테마, UI 설정) |
| 서버 상태 | TanStack Query (React Query) |
| 차트 | Chart.js + react-chartjs-2 |
| 테이블 | TanStack Table |
| 스타일 | CSS Modules + 디자인 토큰 |

---

## 폴더 구조

```
dashboard/
├── app.py                  # Flask API 서버 + 엑셀 파싱
├── frontend/
│   └── src/
│       ├── api/            # HTTP 통신만 담당
│       ├── store/          # Zustand 전역 상태 (필터, 테마, UI)
│       ├── hooks/          # React Query 데이터 훅
│       │   └── viewmodels/ # 데이터 변환·포맷팅 (컴포넌트는 여기서만 받음)
│       ├── components/
│       │   ├── ui/         # 순수 표현 컴포넌트 (props만)
│       │   └── features/   # ViewModel 호출 + ui 조합
│       ├── layouts/        # Navbar, FilterBar
│       └── pages/          # Dashboard 페이지
├── docs/                   # API 스펙, 데이터 스키마, 세션 로그
└── .claude/                # Claude Code 자동화 설정
```

---

## 실행 방법

### 1. 백엔드 (Flask)
```bash
pip install -r requirements.txt
python app.py
# → http://localhost:5000
```

> 엑셀 파일 경로: `app.py` 상단 `EXCEL_PATH` 변수를 환경에 맞게 수정하세요.
> 현재는 `C:\Users\aaa\Desktop\기술교육실_프로젝트 보고서 수집\재무관점 필수 데이터 추출.xlsx`

### 2. 프론트엔드 (React)
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173 (Vite가 Flask 5000으로 프록시)
```

### 3. 윈도우 통합 실행
```
start_server.bat 실행 → http://localhost:5000 (통합 서버)
```

---

## 데이터 갱신

엑셀 파일이 업데이트됐을 때 대시보드 우상단 **↺ 갱신** 버튼을 누르면 캐시가 리셋되고 새 데이터를 불러옵니다.

PPT 추출 스크립트는 별도로 돌려야 해요. 스크립트 결과가 엑셀에 저장되면, 그다음 갱신 버튼으로 반영됩니다.

---

## 알려진 데이터 품질 이슈

- **이익율 이상값**: PPT 파싱 시 일부 슬라이드에서 이익율 대신 금액값이 들어오는 경우가 있어요. 서버에서 200% 초과 시 자동 보정하고 로그를 남깁니다.
- **임시 프로젝트 코드**: "생성예정", "미정" 같은 임시 코드는 인사이트 섹션에서 자동으로 제외됩니다.
- **파트/연도 자동 추출**: 파일명 패턴(`26년_프로젝트명_파트명_단계.pptx`)에서 파싱합니다. 네이밍 규칙이 달라지면 '기타'로 처리됩니다.

---

## GitHub

```
https://github.com/ghtjd1358/Finance-Dashboard.git
```
