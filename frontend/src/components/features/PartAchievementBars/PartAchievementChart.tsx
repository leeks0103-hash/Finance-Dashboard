import type { PerfPartRow } from '@/hooks/viewmodels/usePerformanceViewModel';
import { useTheme } from '@/hooks';
import { useUiStore } from '@/store';
import { Button } from '@/components/ui';
import PartAchievementBars from './PartAchievementBars';
import PartAchievementRose from './PartAchievementRose';
import styles from './PartAchievementBars.module.css';

interface Props {
  rows:  PerfPartRow[];
  month: string;
  onPartClick?: (part: string) => void;
}

const VIEWS = [
  { id: 'bars', label: '막대' },
  { id: 'rose', label: '장미' },
] as const;

/**
 * 차트 카드 안의 "파트별 매출 실적 진행 현황" 본문 — 왼쪽 아래 토글로 기존 막대 / 장미(폴라) 차트를 골라 봄(2026-11-06 요청).
 * **토글은 관리자에게만 보임**(요청) — 일반 사용자는 저장된 값과 상관없이 항상 기존 막대.
 * 관리자가 고른 보기는 이 브라우저에 기억(ui.store achieveView, 기본 막대). 장미는 주간·야간 둘 다 지원.
 */
const PartAchievementChart = ({ rows, month, onPartClick }: Props) => {
  const { theme } = useTheme();
  const isAdmin = useUiStore(s => s.adminAuthed);
  const stored = useUiStore(s => s.achieveView);
  const setView = useUiStore(s => s.setAchieveView);
  const view = isAdmin ? stored : 'bars';

  return (
    <div className={styles.chartWrap}>
      <div className={styles.chartMain}>
        {view === 'rose'
          ? <PartAchievementRose rows={rows} dark={theme === 'dark'} onPartClick={onPartClick} />
          : <PartAchievementBars bare rows={rows} month={month} onPartClick={onPartClick} />}
      </div>
      {isAdmin && (
        <div className={styles.viewToggle} role="group" aria-label="파트별 매출 실적 진행 현황 보기 방식">
          {VIEWS.map(v => (
            <Button
              key={v.id}
              variant="ghost"
              size="sm"
              className={`${styles.viewBtn} ${view === v.id ? styles.viewBtnActive : ''}`}
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PartAchievementChart;
