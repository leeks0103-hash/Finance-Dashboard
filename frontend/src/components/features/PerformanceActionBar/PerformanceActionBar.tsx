// usePerfExport(CSV 내보내기) — 담당자 지정으로 CSV 버튼을 내리고 엑셀 원본 다운로드로 대체.
// 복구하려면 아래 import와 <CsvExportBar> 한 줄을 함께 되살릴 것.
// import { usePerfExport } from '@/hooks/usePerfExport';
// import { CsvExportBar } from '@/components/ui';
import { usePerformanceSummary } from '@/hooks/usePerformanceSummary';
import { useDownloadFiles } from '@/hooks/useDownloadFiles';
import { DownloadMenu } from '@/components/ui';
import styles from './PerformanceActionBar.module.css';

function fmtTs(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.length >= 16 ? raw.slice(5, 16) : raw;
}

const PerformanceActionBar = () => {
  const { data: sum }   = usePerformanceSummary();
  const { data: files, isLoading } = useDownloadFiles();
  const displayTs = fmtTs(sum?.loaded_at);

  return (
    <div className={styles.bar}>
      <DownloadMenu
        items={files ?? []}
        isLoading={isLoading}
        hrefOf={key => `/api/download/${key}`}
        buttonLabel="↓ 재무데이터 다운로드"
      />
      {displayTs && (
        <span className={styles.lastLoaded} title="데이터 최종 업데이트">
          업데이트 {displayTs}
        </span>
      )}
    </div>
  );
};

export default PerformanceActionBar;
