import { useLocation, useNavigate } from 'react-router-dom';
import styles from './TabRemote.module.css';

const TABS = [
  { id: 'finance',     label: '재무\n데이터', short: '재무' },
  { id: 'kpi',         label: 'KPI',         short: 'KPI'  },
  { id: 'performance', label: '실적\n현황',   short: '실적' },
] as const;

function pathToTab(pathname: string) {
  if (pathname.startsWith('/kpi'))         return 'kpi';
  if (pathname.startsWith('/performance')) return 'performance';
  return 'finance';
}

const TabRemote = () => {
  const location = useLocation();
  const navigate  = useNavigate();
  const active    = pathToTab(location.pathname);

  return (
    <div className={styles.remote}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`${styles.btn} ${active === tab.id ? styles.active : ''}`}
          onClick={() => navigate(`/${tab.id}`)}
          title={tab.short}
        >
          {tab.label.split('\n').map((line, i) => (
            <span key={i} className={styles.line}>{line}</span>
          ))}
          {active === tab.id && <span className={styles.dot} />}
        </button>
      ))}
    </div>
  );
};

export default TabRemote;
