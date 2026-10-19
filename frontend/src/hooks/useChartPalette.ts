import { useMemo } from 'react';
import { useTheme } from './useTheme';
import { useUiStore } from '@/store';
import { getChartPalette, type ChartPalette, type ChartColorOverrides, type ColorMode } from '@/utils/chartColors';

/** 테마 + 사용자 지정 차트 색(⚙ 설정 > 차트 색상)을 반영한 팔레트 — 차트 색은 모두 여기서 받음(2026-10-08) */
// draft를 주면 저장된 색 대신 그걸로 — 차트 색상 모달 미리보기가 저장 전 선택을 보여 줄 때(2026-10-13).
// mode를 주면 지금 테마 대신 그 모드로 — 모달에서 주간/야간 탭을 따로 볼 때. 저장 색도 모드별(2026-10-19)
export const useChartPalette = (draft?: ChartColorOverrides, mode?: ColorMode): ChartPalette => {
  const { theme } = useTheme();
  const dark = (mode ?? theme) === 'dark';
  const saved = useUiStore(s => s.chartColors[dark ? 'dark' : 'light']);
  const overrides = draft ?? saved;
  return useMemo(() => getChartPalette(dark, overrides), [dark, overrides]);
};
