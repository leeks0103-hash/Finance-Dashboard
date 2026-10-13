import { useMemo } from 'react';
import { useTheme } from './useTheme';
import { useUiStore } from '@/store';
import { getChartPalette, type ChartPalette, type ChartColorOverrides } from '@/utils/chartColors';

/** 테마 + 사용자 지정 차트 색(⚙ 설정 > 차트 색상)을 반영한 팔레트 — 차트 색은 모두 여기서 받음(2026-10-08) */
// draft를 주면 저장된 색 대신 그걸로 — 차트 색상 모달 미리보기가 저장 전 선택을 보여 줄 때(2026-10-13)
export const useChartPalette = (draft?: ChartColorOverrides): ChartPalette => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const saved = useUiStore(s => s.chartColors);
  const overrides = draft ?? saved;
  return useMemo(() => getChartPalette(dark, overrides), [dark, overrides]);
};
