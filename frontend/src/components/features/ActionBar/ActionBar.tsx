import { useExport } from '@/hooks/useExport';
import { Button, DownloadModal } from '@/components/ui';
import styles from './ActionBar.module.css';

/**
 * ActionBar
 * - 훅: useExport() — CSV/PDF/Reload 동작 + 로딩 상태 전부 담당
 * - 컴포넌트: 렌더링만.
 */
const ActionBar = () => {
  const { exportCsv, exportPdf, isExportingPdf, showPdfModal, reload, isReloading } = useExport();

  return (
    <>
      <div className={styles.bar}>
        <Button variant="success" onClick={exportCsv}>↓ CSV</Button>
        <Button variant="danger"  onClick={exportPdf} loading={isExportingPdf} disabled={isExportingPdf}>
          {isExportingPdf ? 'PDF 생성 중…' : '↓ PDF'}
        </Button>
        <Button variant="ghost" onClick={() => reload()} loading={isReloading}>↺ 갱신</Button>
      </div>

      {/* PDF 모달 — 300ms 이상 걸릴 때만 표시 */}
      <DownloadModal open={showPdfModal} filename="재무현황 PDF" />
    </>
  );
};

export default ActionBar;
