import { useExport } from '@/hooks/useExport';
import { useSummary } from '@/hooks/useSummary';
import { useUiStore } from '@/store';
import { Button, DownloadModal } from '@/components/ui';
import styles from './ActionBar.module.css';

function fmtTs(raw: string | null | undefined): string {
  if (!raw) return '';
  // "2026-08-26 14:30:00" → "08-26 14:30"
  return raw.length >= 16 ? raw.slice(5, 16) : raw;
}

const ActionBar = () => {
  const { exportCsv, exportPdf, isExportingPdf, showPdfModal, reload, isReloading, correctedRows } = useExport();
  const lastLoaded    = useUiStore(s => s.lastLoaded);   // reload 클릭 시 갱신
  const { data: sum } = useSummary();                    // 초기 로드 시각 (서버 응답)
  const displayTs = lastLoaded || fmtTs(sum?.loaded_at); // reload > 초기 순서로 우선

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
          {displayTs && <span className={styles.lastLoaded} title="데이터 최종 업데이트">업데이트 {displayTs}</span>}
          {correctedRows > 0 && <span className={styles.correctedBadge}>{correctedRows}행 보정됨</span>}
        </div>
      </div>
      <DownloadModal open={showPdfModal} filename="재무현황 PDF" />
    </>
  );
};

export default ActionBar;
