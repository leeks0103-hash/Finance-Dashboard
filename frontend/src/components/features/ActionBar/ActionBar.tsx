import { useExport } from '@/hooks/useExport';
import { Button, DownloadModal } from '@/components/ui';
import styles from './ActionBar.module.css';

/**
 * ActionBar
 * - 훅: useExport() — CSV/PDF/Reload 동작 + 로딩 상태 전부 담당
 * - 컴포넌트: 렌더링만.
 */
const ActionBar = () => {
  const { exportCsv, exportPdf, isExportingPdf, reload, isReloading } = useExport();

  return (
    <>
      <div className={styles.bar}>
        <Button variant="success" onClick={exportCsv}>↓ CSV</Button>
        <Button variant="danger"  onClick={exportPdf} loading={isExportingPdf} disabled={isExportingPdf}>
          {isExportingPdf ? 'PDF 생성 중…' : '↓ PDF'}
        </Button>
        <Button variant="ghost" onClick={() => reload()} loading={isReloading}>↺ 갱신</Button>
      </div>

      {/* PDF 다운로드 진행 모달 */}
      <DownloadModal open={isExportingPdf} filename="재무현황 PDF" />
    </>
  );
};

export default ActionBar;
