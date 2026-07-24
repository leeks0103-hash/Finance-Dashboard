# Finance Dashboard — CLAUDE.md

## 프로젝트 문서
- API 스펙: @docs/api-spec.md
- 데이터 스키마: @docs/data-schema.md
- 세션 진행 기록: @docs/session-log.md
- 알려진 문제 코드: @docs/known-issues.md

## 아키텍처

```
PPT 보고서 → Python 추출 스크립트 → 엑셀(.xlsx) → Flask API → React 대시보드
```

## 기술 스택
- **Backend**: Python · Flask · pandas · reportlab · waitress
- **Frontend**: Vite · React 19 · TypeScript · Zustand · TanStack Query · Chart.js
- **데이터**: 로컬 엑셀 파일 (시트명: `취합`, 13컬럼)

---

## Frontend 아키텍처 규칙 (`frontend/src/`)

### 레이어 의존성 (단방향, 절대 역방향 금지)
```
types/ → utils/ → api/ → store/ → hooks/ → hooks/viewmodels/ → ui/ → features/ → pages/ → App
```

### 각 레이어 책임

| 레이어 | 책임 | 금지 사항 |
|--------|------|-----------|
| `types/` | TypeScript 인터페이스만 | 로직 없음 |
| `utils/` | 순수 함수 (formatBillion 등) | 사이드이펙트 없음 |
| `api/` | HTTP 통신만 | 변환 로직 없음 |
| `store/` | Zustand 전역 상태 | API 호출 없음, DOM 조작 없음 |
| `hooks/` | React Query data fetching | 렌더링 없음 |
| `hooks/viewmodels/` | **데이터 fetch + 변환 + null 처리 전부** | 컴포넌트 import 없음, presentation 색상 계산 없음 |
| `components/ui/` | 순수 presentational (props만) | hooks/api import 없음 |
| `components/features/` | ViewModel 호출 + ui 조합 | 비즈니스 로직 없음 |
| `layouts/` | Navbar, FilterBar 조합 | 직접 API 호출 없음 |
| `pages/` | 섹션 조합 + ErrorBoundary | 직접 API 호출 없음 |
| `App.tsx` | lazy + Suspense + 초기화 훅 관리만 | |

### 핵심 원칙: 훅이 모든 걸 책임진다

```tsx
// ❌ 컴포넌트에 로직 있으면 잘못된 것
const { data, isLoading } = useSummary();
if (isLoading || !data) return <Skeleton />;
return <KpiCard value={formatBillion(data.total_revenue)} />;

// ✅ ViewModel이 책임, 컴포넌트는 렌더링만
const vm = useKpiViewModel();
if (vm.isLoading) return <Skeleton />;
return <KpiCard value={vm.revenue} />;
```

### 버튼은 반드시 `<Button variant="...">` 사용
- `variant`: primary / danger / success / ghost
- `loading` prop으로 로딩 상태 처리
- **`<button>` 직접 사용 절대 금지** — 코드 작성 시 즉시 거부

### 상태관리 규칙
- 서버 상태 → TanStack Query (useSummary, useProjects 등)
- 클라이언트 상태 → Zustand store (filter.store, theme.store, ui.store)
- `store/` 안에서 DOM 조작·localStorage 직접 접근 금지 — `persist` 미들웨어 또는 subscribe 사용
- ViewModel이 presentation 색상(labelColor 등)을 파라미터로 받지 않음 — theme은 store에서 직접 읽기

### useMemo / useCallback 사용 규칙
- **반환 객체 리터럴 안에서 useCallback 선언은 정상** (React가 hook 순서를 함수 최상위 기준으로 판단)
- useMemo deps에 객체/배열이 들어가면 **같은 참조인지 확인** — ViewModel useMemo 결과는 stable
- string primitive는 deps에서 값 비교 → 안전
- **`useMemo` deps가 새 참조를 생성하는 경우** 메모이제이션이 무효화됨 — 주의

### key prop 규칙
- 리스트 렌더링 시 **인덱스(i) key 금지** — 내용 기반 key 사용
- 테마 전환 시 차트 리마운트가 필요한 경우 `key={theme}` 사용 (의도적)

---

## Backend 규칙 (app.py)

- `EXCEL_PATH`: `os.environ.get("EXCEL_PATH", 기본값)` — 환경변수 우선
- `load_excel()` 안에서 임시 코드 행(`_is_valid_code`) 제거 → 모든 API에서 일관성
- profit_rate 보정 시 logger.warning으로 추출 스크립트 디버깅 정보 남기기
- `_cache_lock` 보유 상태에서만 `load_excel()` 호출

---

## 파일 구조
```
dashboard/
├── app.py                    # Flask 앱 + 전체 API
├── README.md                 # 프로젝트 설명 (한국어)
├── frontend/
│   └── src/
│       ├── store/            # filter.store, theme.store, ui.store
│       ├── hooks/viewmodels/ # KPI, Chart, Insight, ProjectTable VM
│       ├── components/ui/    # Button, KpiCard, Toggle, FilterChip ...
│       └── components/features/ # KpiSection, ChartSection ...
├── docs/
└── .claude/
    ├── settings.json
    └── skills/deploy/
```

## 규칙
- 커밋 메시지는 한국어로 작성
- 세션 완료 시 `docs/session-log.md` 업데이트
- AI 지시사항(CLAUDE.md, settings.json)은 GitHub에 공유

## Git
- Remote: `https://github.com/ghtjd1358/Finance-Dashboard.git`
- Branch: `main`
