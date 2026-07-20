# Finance Dashboard — CLAUDE.md

## 프로젝트 개요
기술교육사업기획팀 프로젝트 보고서의 재무 데이터를 시각화하는 Flask 웹 대시보드.
엑셀 파일에서 데이터를 읽어 필터링·집계·인사이트 분석 기능을 제공한다.

## 기술 스택
- **Backend**: Python + Flask + openpyxl + waitress
- **Frontend**: Bootstrap 5 + Bootstrap Icons + Chart.js + Jinja2 템플릿
- **데이터 소스**: 로컬 엑셀 파일 (`.xlsx`)

## 파일 구조
```
dashboard/
├── app.py                  # Flask 앱 + API 엔드포인트
├── templates/
│   ├── base.html           # 공통 레이아웃
│   └── index.html          # 메인 대시보드 UI
├── static/
│   └── style.css           # 커스텀 스타일
├── requirements.txt
├── start_server.bat        # 서버 실행 배치 파일
└── .claude/
    ├── settings.local.json # 프로젝트 권한 설정
    └── skills/             # 반복 업무 스킬
```

## 주요 API 엔드포인트
| 경로 | 설명 |
|------|------|
| `GET /` | 대시보드 메인 |
| `GET /api/data` | 원본 데이터 (year/part/stage 필터) |
| `GET /api/summary` | 집계 요약 (매출·지출·이익·원가구성) |
| `GET /api/insights` | 인사이트 분석 (TOP5·리스크·코멘트) |
| `POST /api/reload` | 엑셀 재로드 |

## 데이터 컬럼 매핑 (엑셀 "취합" 시트, 2행~)
| 인덱스 | 필드명 | 설명 |
|--------|--------|------|
| r[0] | project_code | 프로젝트 코드 |
| r[1] | year | 연도 |
| r[2] | part | 파트 |
| r[3] | stage | 보고단계 |
| r[4] | revenue | 매출 |
| r[5] | expenditure | 지출 |
| r[6] | direct_cost | 직접원가 |
| r[7] | labor_cost | 직접인건비 |
| r[8] | overhead | 공통원가/관리비 |
| r[9] | operating_profit | 경상이익 |
| r[10] | profit_rate | 이익율(%) |
| r[11] | note | 비고 |
| r[12] | filename | 파일명 |
| r[13] | processed_at | 처리일 |
| r[14] | reflected_at | 반영일 |

## 알려진 문제 코드 & 해결 기록

### [2026-07-20] EXCEL_PATH 하드코딩 문제
- **문제**: `app.py` 8~13줄에 로컬 전용 절대경로가 하드코딩되어 GitHub에 올라갈 경우 다른 환경에서 동작 불가
- **현황**: 아직 미해결. 향후 `.env` 파일 또는 환경변수(`EXCEL_PATH`)로 분리 필요
- **임시 처치**: 없음. 현재 단일 PC 환경에서만 운영 중

### [2026-07-20] profit_rate 파싱 이중 처리
- **문제**: `safe_num()` 함수가 있음에도 `profit_rate`만 별도 파싱 로직 중복 작성 (app.py 37~45줄)
- **원인**: `safe_num`이 이미 `%` 제거를 처리하므로 `profit_rate`도 `safe_num(r[10])`으로 통일 가능
- **상태**: 기능상 문제 없음. 리팩토링 시 통합 권장

---

## 세션 진행 기록

### [2026-07-20] 초기 구축 세션
**목표**: 재무 대시보드 Flask 앱 초기 구축 + GitHub 업로드

**완료된 작업**:
- Flask 앱 (`app.py`) 구현: 엑셀 로드, 필터링, 집계, 인사이트 API
- `index.html` 대시보드 UI 구현 (연도·파트·보고단계 필터, 차트, 인사이트 카드)
- `style.css` 커스텀 스타일
- Git 초기화 및 첫 커밋 (`9c5f770`)
- GitHub remote를 `https://github.com/ghtjd1358/Finance-Dashboard.git` 로 변경 후 push
- CLAUDE.md, 스킬, 훅 설정 추가

**미완료 / 다음 세션 과제**:
- EXCEL_PATH 환경변수화 (`.env` 파일 도입)
- 데이터 갱신 주기 자동화 고려
- 배포 환경 구성 검토

---

## Git 작업 규칙
- 작업 완료 후 반드시 커밋 → push (`/deploy` 스킬 사용)
- 커밋 메시지: 한국어로 변경사항 요약
- Remote: `https://github.com/ghtjd1358/Finance-Dashboard.git` (branch: `main`)
