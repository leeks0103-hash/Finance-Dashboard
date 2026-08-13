# API 스펙

## 엔드포인트 목록

### `GET /`
메인 대시보드 페이지 반환. Jinja2로 연도·파트·보고단계 필터 옵션 주입.

### `GET /api/data`
원본 데이터 배열 반환.

**쿼리 파라미터**
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `year` | string | 연도 필터 (예: `2024`) |
| `part` | string[] | 파트 필터 (복수 선택 가능) |
| `stage` | string[] | 보고단계 필터 (복수 선택 가능) |

**응답 예시**
```json
[
  {
    "project_code": "P001",
    "year": "2024",
    "part": "A파트",
    "stage": "최종",
    "revenue": 100000000,
    "expenditure": 80000000,
    "direct_cost": 50000000,
    "labor_cost": 20000000,
    "overhead": 10000000,
    "operating_profit": 20000000,
    "profit_rate": 20.0,
    "note": "",
    "filename": "report.xlsx",
    "processed_at": "2024-01-01",
    "reflected_at": "2024-01-05"
  }
]
```

### `GET /api/summary`
집계 요약 반환. 동일 필터 파라미터 사용.

**응답 예시**
```json
{
  "total_revenue": 500000000,
  "total_expenditure": 400000000,
  "total_profit": 100000000,
  "avg_profit_rate": 18.5,
  "count": 12,
  "by_part": {
    "A파트": { "revenue": 200000000, "expenditure": 160000000, "profit": 40000000, "count": 5 }
  },
  "cost_breakdown": {
    "direct_cost": 250000000,
    "labor_cost": 100000000,
    "overhead": 50000000
  }
}
```

### `GET /api/insights`
인사이트 분석 반환. 동일 필터 파라미터 사용.

**응답 예시**
```json
{
  "top": [ { "project_code": "P001", "part": "A파트", "profit_rate": 35.0, ... } ],
  "risk": [ { "project_code": "P010", "operating_profit": -5000000, ... } ],
  "comments": [
    { "type": "positive", "icon": "📈", "text": "<b>A파트</b> 평균 이익율 ..." }
  ]
}
```

**comment type 값**: `positive` / `info` / `neutral` / `warning`

### `POST /api/reload`
엑셀 파일을 다시 읽어 캐시 갱신.

**응답**
```json
{ "ok": true, "loaded_at": "2024-07-20 10:00:00", "count": 42 }
```

### `GET /api/performance/insights`
실적현황 인사이트 반환 (목표 대비 부진 프로젝트, 손실/저수익 경고, 코멘트).

**쿼리 파라미터**
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `part` | string[] | 파트 필터 (복수 선택 가능) |
| `team` | string | 팀 필터 |

**응답 예시**
```json
{
  "worst": [
    { "project_code": "E123...", "part": "① AI・DS", "project_name": "...",
      "plan_initial": 50000, "jun_actual": 0, "achieve_rate": 0.0 }
  ],
  "risk": [
    { "project_code": "E456...", "part": "⑤ 신사업", "project_name": "...",
      "operating_profit": -47841.4, "profit_rate": -23.5 }
  ],
  "comments": [
    { "type": "warning", "icon": "", "text": "<b>...</b> 손실 -0.3억원 — 확인 필요" }
  ]
}
```
`plan_initial`/`jun_actual`/`operating_profit`는 천원 단위 (실적현황 데이터 전체 공통).
