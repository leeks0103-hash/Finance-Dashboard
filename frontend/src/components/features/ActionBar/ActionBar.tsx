import { useExport } from '@/hooks/useExport';
import { Button } from '@/components/ui';
import styles from './ActionBar.module.css';

/**
 * ActionBar
 * - 훅: useExport() — CSV/PDF/Reload 동작 전부 담당
 * - 컴포넌트: 렌더링만.
 */
const ActionBar = () => {
  const { exportCsv, exportPdf, reload, isReloading } = useExport();

  return (
    <div className={styles.bar}>
      <Button variant="success" onClick={exportCsv}>↓ CSV</Button>
      <Button variant="danger"  onClick={exportPdf}>↓ PDF</Button>
      <Button variant="ghost"   onClick={() => reload()} loading={isReloading}>↺ 갱신</Button>
    </div>
  );
};

export default ActionBar;
