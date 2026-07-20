---
name: deploy
description: "변경사항 커밋 & GitHub Push. '깃에 올려', '커밋해', '배포해' 요청 시 트리거."
---

## 목적
작업 완료 후 변경사항을 GitHub에 올리고 세션 기록을 갱신합니다.

## 핵심 루프
작은 변경 → 테스트(브라우저 확인) → 린트 → 커밋 → 반복

## 절차
1. **변경사항 확인**
   ```bash
   git status
   git diff --stat
   ```

2. **스테이징 & 커밋**
   - 관련 파일만 `git add` (불필요한 파일 제외)
   - 커밋 메시지: 한국어로 변경 내용 요약
   ```bash
   git commit -m "변경 내용 요약"
   ```

3. **Push**
   ```bash
   git push origin main
   ```

4. **문서 갱신**
   - `docs/session-log.md`: 오늘 날짜 + 완료 작업 + 다음 과제 추가
   - 문제가 있었다면 `docs/known-issues.md`에도 기록

5. **완료 보고**: 커밋 해시 + 변경 파일 목록 안내

## 자체 검증 체크리스트
- [ ] `.env`, API 키, 개인정보 포함 파일이 커밋에 없는가?
- [ ] 로컬 전용 경로(EXCEL_PATH 등)가 새로 추가되진 않았는가?
- [ ] 브라우저에서 동작을 확인했는가?
- [ ] push 성공 여부 확인했는가?

## 주의사항
- 충돌 시 강제 push 금지 — 사용자에게 먼저 확인
- `settings.local.json`은 gitignore 대상이므로 커밋 불필요
