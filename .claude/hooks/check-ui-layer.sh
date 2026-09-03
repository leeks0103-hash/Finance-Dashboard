#!/usr/bin/env bash
# CLAUDE.md 레이어 규칙 강제: frontend/src/components/ui/** 는 @/hooks, @/api (또는 그에 상응하는
# 상대경로)를 import할 수 없음. Stop 훅에서 실행 — 위반 시 종료를 막고 stderr로 위치를 알려줌.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -n "$ROOT" ] || exit 0
cd "$ROOT" || exit 0

UI_GLOB='frontend/src/components/ui/'
PATTERN="from ['\"](@/(hooks|api)(/|['\"])|(\.\./)+(hooks|api)/)"

TRACKED=$(git diff --name-only HEAD -- "$UI_GLOB" 2>/dev/null || true)
UNTRACKED=$(git ls-files --others --exclude-standard -- "$UI_GLOB" 2>/dev/null || true)
FILES=$(printf '%s\n%s\n' "$TRACKED" "$UNTRACKED" | grep -E '\.(ts|tsx)$' | sort -u || true)

[ -n "$FILES" ] || exit 0

VIOLATIONS=""
while IFS= read -r f; do
  [ -f "$f" ] || continue
  MATCH=$(grep -nE "$PATTERN" "$f" || true)
  if [ -n "$MATCH" ]; then
    VIOLATIONS="${VIOLATIONS}${f}\n${MATCH}\n\n"
  fi
done <<< "$FILES"

if [ -n "$VIOLATIONS" ]; then
  {
    echo "[레이어 규칙 위반] components/ui/ 는 @/hooks, @/api (또는 상대경로로 hooks/api에 도달하는) import를 할 수 없습니다 (CLAUDE.md)."
    echo "위반 위치:"
    printf '%b' "$VIOLATIONS"
    echo "위 import를 제거하거나 컴포넌트 로컬 구현으로 옮긴 뒤 다시 종료를 시도하세요."
  } >&2
  exit 2
fi

exit 0
