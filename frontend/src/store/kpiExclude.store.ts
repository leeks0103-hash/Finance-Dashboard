import { create } from 'zustand';

/** KPI 목표 vs 실적 차트·KPI 집계 표·드릴다운 모달에서 "이번엔 이 프로젝트는 빼고 보고 싶다"는
 *  임시 제외 목록 — 파일명 기준. 의도적으로 persist 없음: 새로고침하면 그냥 초기화된다
 *  (사용자 요청 "완전 임시로"). 서버에도 아무것도 저장하지 않고 매 API 호출마다 이 목록을
 *  쿼리 파라미터로만 넘겨서 그때그때 재계산한다. */
interface KpiExcludeStore {
  excludedFiles: string[];
  toggleExclude: (file: string) => void;
  clearExcluded: () => void;
}

export const useKpiExcludeStore = create<KpiExcludeStore>()(set => ({
  excludedFiles: [],
  toggleExclude: file => set(s => ({
    excludedFiles: s.excludedFiles.includes(file)
      ? s.excludedFiles.filter(f => f !== file)
      : [...s.excludedFiles, file],
  })),
  clearExcluded: () => set({ excludedFiles: [] }),
}));
