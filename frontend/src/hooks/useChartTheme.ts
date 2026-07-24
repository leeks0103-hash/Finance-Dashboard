import { useEffect } from 'react';
import { defaults } from 'chart.js';
import { useTheme } from './useTheme';

export function useChartTheme() {
  const { theme } = useTheme();

  useEffect(() => {
    const dark = theme === 'dark';
    // 기본 텍스트 색 (범례 fallback 용도 — 실제 색상은 ChartSection이 prop으로 주입)
    defaults.color = dark ? 'rgba(91,168,204,0.8)' : '#64748B';

    // 등록된 모든 scale type에 대해 grid/tick 기본값 설정
    const scales = (defaults as any).scales ?? {};
    Object.keys(scales).forEach(type => {
      scales[type].grid  ??= {};
      scales[type].ticks ??= {};
      // ChartSection이 options.scales로 직접 주입하므로 defaults는 fallback만 담당
    });
  }, [theme]);
}
