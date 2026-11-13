import type { ReactNode } from 'react';
import { useUiStore } from '@/store';
import { Button } from '@/components/ui';
import styles from './CostChartSwitch.module.css';

interface Props {
  /** 기존 막대 차트 */
  bars:     ReactNode;
  /** 덤벨 차트 */
  dumbbell: ReactNode;
}

const VIEWS = [
  { id: 'bars', label: '막대' },
  { id: 'dumbbell', label: '덤벨' },
] as const;

/**
 * "원가분석(파트별 추정 매출/원가)" 카드 본문 — 왼쪽 아래 토글로 기존 막대 / 덤벨을 골라 봄(2026-11-10 요청,
 * "파트별 매출 실적 진행 현황"의 막대/장미 토글과 같은 방식·같은 모양).
 * **토글은 관리자에게만 보임** — 일반 사용자는 저장된 값과 상관없이 항상 기존 막대(모두에게 열려면 isAdmin 조건만 빼면 됨).
 * 고른 보기는 이 브라우저에 기억(ui.store costView, 기본 막대)
 */
const CostChartSwitch = ({ bars, dumbbell }: Props) => {
  const isAdmin = useUiStore(s => s.adminAuthed);
  const stored = useUiStore(s => s.costView);
  const setView = useUiStore(s => s.setCostView);
  const view = isAdmin && stored === 'dumbbell' ? 'dumbbell' : 'bars';

  return (
    <div className={styles.chartWrap}>
      <div className={styles.chartMain}>{view === 'dumbbell' ? dumbbell : bars}</div>
      {isAdmin && (
        <div className={styles.viewToggle} role="group" aria-label="원가분석 보기 방식">
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

export default CostChartSwitch;
