import { useExport } from '@/hooks/useExport';
import { useFilterPanelViewModel } from '@/hooks/viewmodels';
import { Button, DownloadModal } from '@/components/ui';

const ActionBar = () => {
  const { exportCsv, exportPdf, isExportingPdf, showPdfModal, reload, isReloading } = useExport();
  const { hasActiveFilters, resetFilters } = useFilterPanelViewModel();

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>
        {hasActiveFilters && (
          <Button variant="danger" size="sm" onClick={resetFilters}>✕ 초기화</Button>
        )}
        <Button variant="success" size="sm" onClick={exportCsv}>↓ CSV</Button>
        <Button variant="danger"  size="sm" onClick={exportPdf} loading={isExportingPdf} disabled={isExportingPdf}>
          {isExportingPdf ? '생성 중…' : '↓ PDF'}
        </Button>
        <Button variant="ghost"   size="sm" onClick={() => reload()} disabled={isReloading}>
          {isReloading ? '갱신 중…' : '↺ 갱신'}
        </Button>
      </div>
      <DownloadModal open={showPdfModal} filename="재무현황 PDF" />
    </>
  );
};

export default ActionBar;
