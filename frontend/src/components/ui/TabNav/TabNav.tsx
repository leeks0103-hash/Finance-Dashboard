import type { TabId } from '@/store/tab.store';
import styles from './TabNav.module.css';

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: 'finance',     label: '재무 데이터' },
  { id: 'kpi',         label: 'KPI' },
  { id: 'performance', label: '실적 현황' },
];

interface Props {
  active:   TabId;
  onChange: (id: TabId) => void;
}

const TabNav = ({ active, onChange }: Props) => (
  <nav className={styles.nav} role="tablist">
    {TABS.map(tab => (
      <button
        key={tab.id}
        role="tab"
        aria-selected={active === tab.id}
        className={`${styles.tab} ${active === tab.id ? styles.active : ''}`}
        onClick={() => onChange(tab.id)}
      >
        {tab.label}
      </button>
    ))}

  </nav>
);

export default TabNav;
