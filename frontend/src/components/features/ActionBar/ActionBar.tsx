import { useExport } from '@/hooks/useExport';
import { Button, DownloadModal } from '@/components/ui';
import styles from './ActionBar.module.css';

const ActionBar = () => {
  const { exportCsv, exportPdf, isExportingPdf, showPdfModal, reload, isReloading } = useExport();

  return (
    <>
      <div className={styles.bar}>
        <Button variant="success" onClick={exportCsv}>↓ CSV</Button>
        <Button variant="danger"  onClick={exportPdf} loading={isExportingPdf} disabled={isExportingPdf}>
          {isExportingPdf ? 'PDF 생성 중…' : '↓ PDF'}
        </Button>
        <button
          className={styles.reloadBtn}
          onClick={() => reload()}
          disabled={isReloading}
          aria-label="데이터 갱신"
        >
          {isReloading ? '갱신 중…' : '↺ 갱신'}
        </button>
      </div>
      <DownloadModal open={showPdfModal} filename="재무현황 PDF" />
    </>
  );
};

export default ActionBar;
