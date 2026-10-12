import { useMemo } from 'react';
import { useTheme } from './useTheme';
import { useUiStore } from '@/store';
import { getChartPalette, type ChartPalette } from '@/utils/chartColors';

/** 테마 + 사용자 지정 차트 색(⚙ 설정 > 차트 색상)을 반영한 팔레트 — 차트 색은 모두 여기서 받음(2026-10-08) */
export const useChartPalette = (): ChartPalette => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const overrides = useUiStore(s => s.chartColors);
  return useMemo(() => getChartPalette(dark, overrides), [dark, overrides]);
};
