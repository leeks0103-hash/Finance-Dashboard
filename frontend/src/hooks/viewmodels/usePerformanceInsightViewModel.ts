import { usePerformanceInsights } from '@/hooks/usePerformanceInsights';
import { useMissedBidProjects } from '@/hooks/useMissedBidProjects';
import type { InsightRow, Project } from '@/types';
import type { PerfComment } from '@/types/performance.types';

export interface PerformanceInsightViewModel {
  isLoading: boolean;
  isEmpty:   boolean;
  comments:  PerfComment[];
  missedBid: InsightRow[];
  /** 미수주는 실적현황엔 없고 재무(PPT)에만 있는 데이터라 원본 Project 그대로 노출 —
   *  DataTable에서 나머지 필드(연도/단계/매출/원가 등)까지 펼쳐 보여줄 때 사용 */
  missedBidProjects: Project[];
}

// 구버전(목표대비부진/손실·저수익) 코드에서 쓰던 헬퍼 — 주석 처리된 코드가 참조하므로 보존
// const shortCode = (code: string): string =>
//   code.length <= 16 ? code : code.slice(0, 14) + '…';

export const usePerformanceInsightViewModel = (): PerformanceInsightViewModel => {
  const { data, isLoading } = usePerformanceInsights();
  const { data: missedBidData = [], isLoading: missedBidLoading } = useMissedBidProjects();

  if (!data || isLoading) {
    return { isLoading: isLoading || missedBidLoading, isEmpty: false, comments: [], missedBid: [], missedBidProjects: [] };
  }

  const missedBid: InsightRow[] = missedBidData.map(p => ({
    key:         p.project_code,
    displayCode: p.project_code,
    part:        p.part,
    value:       p.note,
    subValue:    p.filename,
  }));

  const isEmpty = !data.comments.length && !missedBid.length;

  return {
    isLoading: isLoading || missedBidLoading,
    isEmpty,
    comments: data.comments,
    missedBid,
    missedBidProjects: missedBidData,

    // ── 구버전 — 목표대비부진/손실·저수익 (2026-08 [미수주] 리스트로 교체, 삭제하지 않고 보존) ──
    // worst: data.worst.map((r, i) => ({
    //   key:         `${r.project_code}-${i}`,
    //   displayCode: shortCode(r.project_code),
    //   part:        r.part,
    //   value:       `${r.achieve_rate}%`,
    //   valueColor:  r.achieve_rate < 70 ? 'var(--loss)' : 'var(--warn)',
    //   subValue:    `${formatEok(r.jun_actual)} / ${formatEok(r.plan_initial)}`,
    // })),
    // risk: data.risk.map((r, i) => ({
    //   key:         `${r.project_code}-${i}`,
    //   displayCode: shortCode(r.project_code),
    //   part:        r.part,
    //   value:       r.operating_profit < 0 ? '손실' : `${r.profit_rate}%`,
    //   valueColor:  r.operating_profit < 0 ? 'var(--loss)' : 'var(--warn)',
    //   subValue:    r.operating_profit < 0
    //     ? `손실 ${formatEok(Math.abs(r.operating_profit))}`
    //     : formatEok(r.operating_profit),
    // })),
  };
};
