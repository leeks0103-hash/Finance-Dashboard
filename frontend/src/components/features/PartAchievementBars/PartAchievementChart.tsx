import type { PerfPartRow } from '@/hooks/viewmodels/usePerformanceViewModel';
import { useTheme } from '@/hooks';
import PartAchievementBars from './PartAchievementBars';
import PartAchievementRose from './PartAchievementRose';

interface Props {
  rows:  PerfPartRow[];
  month: string;
  onPartClick?: (part: string) => void;
}

/**
 * 차트 카드 안의 "파트별 매출 실적 진행 현황" 본문 — 주간은 기존 막대(트랙 + 구간 색), 야간은 장미(폴라) 차트(2026-11-06 요청).
 * 되돌리려면 아래 분기를 지우고 PartAchievementBars만 렌더하면 됨
 */
const PartAchievementChart = ({ rows, month, onPartClick }: Props) => {
  const { theme } = useTheme();
  return theme === 'dark'
    ? <PartAchievementRose rows={rows} onPartClick={onPartClick} />
    : <PartAchievementBars bare rows={rows} month={month} onPartClick={onPartClick} />;
};

export default PartAchievementChart;
