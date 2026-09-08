import { Button } from '@/components/ui/Button';
import styles from './TabNav.module.css';

export type TabId = 'finance' | 'kpi' | 'performance' | 'satisfaction';

interface Tab {
  id: TabId;
  label: string;
}

// 'finance'(구 재무 데이터 탭)는 /finance URL로 직접 접근은 유지하되 네비게이션에서는 제외 — 재무현황(실적 데이터 기반)으로 통합
const TABS: Tab[] = [
  { id: 'performance',  label: '경영실적/재무데이터' },
  { id: 'kpi',          label: 'KPI/경영현황' },
  // 데이터 소스·파이프라인 미정이라 네비게이션에서 잠시 내림 (아래 한 줄 주석 해제하면 복구)
  // { id: 'satisfaction', label: '강사만족도' },
];

interface Props {
  active:   TabId;
  onChange: (id: TabId) => void;
}

const TabNav = ({ active, onChange }: Props) => (
  <nav className={styles.nav} role="tablist">
    {TABS.map(tab => (
      <Button
        key={tab.id}
        unstyled
        role="tab"
        aria-selected={active === tab.id}
        className={`${styles.tab} ${active === tab.id ? styles.active : ''}`}
        onClick={() => onChange(tab.id)}
      >
        {tab.label}
      </Button>
    ))}
  </nav>
);

export default TabNav;
