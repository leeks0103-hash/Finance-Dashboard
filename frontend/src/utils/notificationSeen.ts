/**
 * 알림 종의 "새 알림"(빨간 점) 판정 — 메일함처럼, 종을 열어 확인하면 점이 사라지고 **새로 늘어난 게 있을 때만** 다시 켜짐(2026-11-06).
 * 확인한 시점의 건수를 이 브라우저에 기억해 두고(ui.store.notificationSeen) 지금 건수와 항목별로 비교한다.
 * 건수가 같거나 줄었으면 새 알림이 아님 — 예전 숫자 배지는 확인해도 안 사라져서 "확인했는데 왜 계속 있냐"는 의견이 있었음.
 */

/** 항목별 건수 — 키는 "finance.pending"·"kpi.failed" 꼴 */
export type SeenCounts = Record<string, number>;

interface AlertCountsLike { pending?: number; failed?: number; modified?: number }

const FIELDS = ['pending', 'failed', 'modified'] as const;

/** 서버가 센 재무·KPI 건수를 항목별 한 줄 기록으로 — 없는 값은 0 */
export const flattenCounts = (finance?: AlertCountsLike, kpi?: AlertCountsLike): SeenCounts => {
  const out: SeenCounts = {};
  for (const f of FIELDS) {
    out[`finance.${f}`] = Math.max(0, finance?.[f] ?? 0);
    out[`kpi.${f}`] = Math.max(0, kpi?.[f] ?? 0);
  }
  return out;
};

/** 확인한 뒤로 한 항목이라도 늘었으면 true — 아직 한 번도 확인 안 했으면(seen 없음) 0이 아닌 항목이 있는지로 */
export const hasUnseen = (current: SeenCounts, seen: SeenCounts | null | undefined): boolean =>
  Object.keys(current).some(k => current[k] > (seen?.[k] ?? 0));

/**
 * 확인해 둔 건수를 지금 건수 이하로 낮춤 — 해결돼서 줄었다가 나중에 다시 늘 때도 "새로 늘었다"로 잡으려고.
 * (안 낮추면 확인 때 263건 → 5건으로 줄었다 10건으로 늘어도 263보다 작아 점이 안 켜짐)
 * 낮출 게 없으면 같은 객체를 돌려줌(불필요한 저장·다시 그리기 방지)
 */
export const lowerSeen = (current: SeenCounts, seen: SeenCounts | null | undefined): SeenCounts | null => {
  if (!seen) return null;
  let changed = false;
  const next: SeenCounts = {};
  for (const k of Object.keys(seen)) {
    const v = Math.min(seen[k], current[k] ?? 0);
    if (v !== seen[k]) changed = true;
    next[k] = v;
  }
  return changed ? next : seen;
};
