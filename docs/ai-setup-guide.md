# AI 분석 기능 설치 가이드 (H-Chat 연동)

> 이 문서는 **다른 PC에서 이 저장소를 git pull(clone)한 사람**이 AI 분석 기능(🤖 버튼)을
> 자기 환경에서도 쓸 수 있게 설정하는 방법입니다. AI 에이전트(Claude Code 등)에게 이 문서를
> 주고 "이 가이드대로 세팅해줘"라고 하면 그대로 따라할 수 있게 작성했습니다.

## 1. 무엇이 필요한가

AI 분석 기능(`ai_insight.py`)은 사내 **H-Chat**(Claude API 사내 게이트웨이)을 호출합니다.
아래 3개 환경변수가 있어야 동작합니다:

| 변수 | 설명 |
|---|---|
| `H_CHAT_API_KEY` | H-Chat API 키 |
| `H_CHAT_BASE_URL` | 사내 게이트웨이 엔드포인트 |
| `H_CHAT_API_MODEL` | 사용할 모델명 |

이 값들은 **`.env` 파일에만 넣습니다** (`.gitignore`에 포함되어 git에 올라가지 않음 —
저장소를 pull해도 자동으로 따라오지 않고, 각자 자기 `.env`에 직접 넣어야 함).

## 2. API 키 발급/확인

- H-Chat API 키는 **본인 명의로 발급받은 키를 쓰는 것을 권장**합니다(공용 키 공유는
  사용량 추적·보안 관점에서 권장하지 않음).
- 발급 방법을 모르면 사내 H-Chat Desktop 앱 설정 화면이나 담당 부서에 문의하세요.
- 이미 다른 프로젝트에서 H-Chat을 써봤다면(예: 사내 자동화 스크립트), 그때 쓰던
  `H_CHAT_API_KEY`/`H_CHAT_BASE_URL`/`H_CHAT_API_MODEL` 값을 그대로 재사용해도 됩니다.

## 3. 설정 방법

1. 이 프로젝트 루트(`dashboard/`)에 `.env` 파일이 없으면 새로 만듭니다.
   (다른 필수 값들 — `EXCEL_PATH`, `KPI_EXCEL_PATH` 등 — 은 기존 `.env` 안내를 참고)
2. `.env` 맨 아래에 다음 3줄을 추가합니다(실제 키 값으로 교체):

   ```env
   H_CHAT_API_KEY="여기에 본인 API 키"
   H_CHAT_BASE_URL="https://internal-apigw-kr.hmg-corp.io/hchat-in/api/v3/claude/messages"
   H_CHAT_API_MODEL="claude-sonnet-4-6"
   ```

   - `H_CHAT_BASE_URL`/`H_CHAT_API_MODEL`은 보통 이 값 그대로 쓰면 됩니다(사내 게이트웨이
     주소는 조직 공통이라 바뀔 일이 거의 없음). 사내 정책상 주소가 다르면 그 값으로 교체.
3. 백엔드를 재시작합니다: `python dashboard_manager.py --restart`
   (Flask는 코드/환경변수 변경 시 자동 반영이 안 되므로 반드시 재시작 필요)

## 4. 확인 방법

재시작 후 브라우저에서 "경영실적/재무데이터" 또는 "KPI/경영현황" 탭을 열고,
다운로드 버튼 왼쪽의 🤖 아이콘을 클릭합니다. 최초 1회는 15~30초 정도 걸릴 수 있습니다
(H-Chat 응답 대기). 정상적으로 분석문이 뜨면 설정이 끝난 것입니다.

터미널에서 직접 확인하려면:
```bash
curl http://localhost:5000/api/ai/finance
curl http://localhost:5000/api/ai/kpi
```
`{"text": "...", "generated_at": "..."}` 형태로 응답이 오면 정상입니다.
`H_CHAT_API_KEY가 설정되지 않았습니다` 에러가 뜨면 `.env`를 다시 확인하세요.

## 5. 참고 — 이 기능이 하는 일

`ai_insight.py`가 실적/KPI 데이터에서 지표(계획·달성률·손익률·원가율 등)를 미리
계산해서 H-Chat(Claude)에 넘기고, 분석문을 받아 `data/ai_analysis_cache.json`에
캐싱합니다(원본 데이터가 재추출되기 전까지는 캐시를 그대로 씀 — 매번 H-Chat을
새로 부르지 않음). 해석 규칙·프롬프트 설계 배경은 `docs/dashboard-analysis-guide.md`
Part 6·7·8을 참고하세요.

## 6. 보안 관련 참고사항

`ai_insight.py`는 H-Chat 호출 시 `httpx.Client(verify=False, ...)`를 씁니다 —
사내 API 게이트웨이가 쓰는 내부 CA 인증서가 시스템 신뢰 저장소에 없어서 TLS 인증서
검증을 끈 것입니다(사내 다른 프로젝트의 기존 H-Chat 연동과 동일한 방식). 사내망
바깥으로 나가는 요청이 아니므로 실질 리스크는 낮지만, 인지하고 있어야 합니다.
사내 CA 인증서 파일을 구할 수 있으면 `verify=False` 대신 그 인증서 경로로
검증하도록 바꾸는 게 더 안전합니다.
