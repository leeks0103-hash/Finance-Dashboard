import { useExport } from '@/hooks/useExport';
import styles from './ActionBar.module.css';

interface Props { lastLoaded?: string; }

const ActionBar = ({ lastLoaded }: Props) => {
  const { exportCsv, exportPdf, reload, isReloading } = useExport();
  return (
    <div className={styles.bar}>
      {lastLoaded && <span className={styles.time}>{lastLoaded}</span>}
      <button className={`${styles.btn} ${styles.csv}`} onClick={exportCsv}>↓ CSV</button>
      <button className={`${styles.btn} ${styles.pdf}`} onClick={exportPdf}>↓ PDF</button>
      <button className={`${styles.btn} ${styles.reload}`} onClick={() => reload()} disabled={isReloading}>
        {isReloading ? '⟳ 갱신 중…' : '↺ 갱신'}
      </button>
    </div>
  );
};

export default ActionBar;
