import { useEffect, useState } from 'react';
import { useUiStore } from '@/store';
import { fadeDatalabels, resetDatalabelAlpha } from '@/utils/datalabelFade';

/**
 * "그래프 수치" 토글 — 켤 때/끌 때 모두 페이드.
 * 끄기: 불투명도 1→0을 먼저 끝낸 뒤 store를 false로(차트 옵션 display:false = none).
 * 켜기: 불투명도 0으로 맞춰두고 store를 true로 → 0→1.
 * 토글 스위치는 store가 아니라 사용자 의도(checked)를 따라 즉시 움직인다.
 */
export const useChartLabelToggle = () => {
  const shown = useUiStore(s => s.showChartLabels);
  const [checked, setChecked] = useState(shown);

  // 다른 경로(초기 복원 등)로 store가 바뀌면 스위치도 맞춤
  useEffect(() => { setChecked(shown); }, [shown]);

  const toggle = () => {
    const next = !checked;
    setChecked(next);
    if (next) {
      if (!useUiStore.getState().showChartLabels) {
        resetDatalabelAlpha(0);
        useUiStore.setState({ showChartLabels: true });
      }
      fadeDatalabels(1);   // 페이드아웃 도중 다시 켜면 그 지점부터 되돌아감
    } else {
      fadeDatalabels(0, () => useUiStore.setState({ showChartLabels: false }));
    }
  };

  return { checked, toggle };
};
