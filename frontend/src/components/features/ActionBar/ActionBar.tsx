import { useExport } from '@/hooks/useExport';
import { useUiStore } from '@/store';
import { Button, DownloadModal } from '@/components/ui';
import styles from './ActionBar.module.css';

const ActionBar = () => {
  const { exportCsv, exportPdf, isExportingPdf, showPdfModal, reload, isReloading, correctedRows } = useExport();
  const lastLoaded = useUiStore(s => s.lastLoaded);

  return (
    <>
      <div className={styles.bar}>
        <Button variant="success" size="sm" onClick={exportCsv}>↓ CSV</Button>
        <Button variant="danger"  size="sm" onClick={exportPdf} loading={isExportingPdf} disabled={isExportingPdf}>
          {isExportingPdf ? '생성 중…' : '↓ PDF'}
        </Button>
        <div className={styles.reloadGroup}>
          <Button variant="ghost" size="sm" onClick={() => reload()} disabled={isReloading}>
            {isReloading ? '갱신 중…' : '↺ 갱신'}
          </Button>
          {lastLoaded && <span className={styles.lastLoaded}>{lastLoaded}</span>}
          {correctedRows > 0 && <span className={styles.correctedBadge}>{correctedRows}행 보정됨</span>}
        </div>
      </div>
      <DownloadModal open={showPdfModal} filename="재무현황 PDF" />
    </>
  );
};

export default ActionBar;
