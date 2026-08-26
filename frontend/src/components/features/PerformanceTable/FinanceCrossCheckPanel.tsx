import { useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProjects } from '@/api/finance.api';
import { Button, Spinner, CopyText } from '@/components/ui';
import { sortStages } from '@/utils/stageOrder';
import { extractRealCode } from '@/utils/projectCode';
import { formatBillion, formatRate } from '@/utils';
import type { Filters, Project } from '@/types/finance.types';
import { STALE_5MIN, GC_10MIN } from '@/hooks/queryClient';
import styles from './FinanceCrossCheckPanel.module.css';

const EMPTY_FILTERS: Filters = { years: [], parts: [], stages: [] };

interface Props {
  projectCode: string;
  onClose:     () => void;
}

const STAGE_COLOR: Record<string, string> = {
  '사전검토': '#818cf8',
  '검토':     '#818cf8',
  '제안':     '#60a5fa',
  '사업계획': '#34d399',
  '착수':     '#34d399',
  '중간':     '#fbbf24',
  '완료':     '#7c3aed',
};

function stageColor(stage: string) {
  for (const [k, v] of Object.entries(STAGE_COLOR)) {
    if (stage.includes(k)) return v;
  }
  return '#94a3b8';
}

function Metric({ label, value, variant }: { label: string; value: string; variant?: 'loss' }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={`${styles.metricValue} ${variant === 'loss' ? styles.loss : ''}`}>
        {value}
      </span>
    </div>
  );
}

function StageCard({ r }: { r: Project }) {
  const isLoss = r.operating_profit < 0;
  const color  = stageColor(r.stage);

  return (
    <div className={styles.card} style={{ '--stage-color': color } as React.CSSProperties}>
      {/* 단계 헤더 */}
      <div className={styles.cardHeader}>
        <span className={styles.stageName}>{r.stage}</span>
        <span className={styles.yearPill}>{r.year}년</span>
      </div>

      {/* 수치 영역 */}
      <div className={styles.body}>
        <div className={styles.metrics}>
          <Metric label="매출"  value={formatBillion(r.revenue)} />
          <Metric label="지출"  value={formatBillion(r.expenditure)} />
          <Metric
            label="이익율"
            value={isLoss
              ? `손실 ${formatBillion(r.operating_profit)}`
              : formatRate(r.profit_rate)
            }
            variant={isLoss ? 'loss' : undefined}
          />
        </div>

        <div className={styles.divider} />

        {/* 비고 */}
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>비고</span>
          {r.note
            ? <p className={styles.infoText}>{r.note}</p>
            : <p className={`${styles.infoText} ${styles.infoEmpty}`}>없음</p>
          }
        </div>

        {/* 파일명 */}
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>파일명</span>
          {r.filename
            ? <CopyText text={r.filename} className={styles.filenameText} />
            : <span className={`${styles.infoText} ${styles.infoEmpty}`}>-</span>
          }
        </div>
      </div>
    </div>
  );
}

const FinanceCrossCheckPanel = ({ projectCode, onClose }: Props) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // 가로 스크롤 시 패널이 현재 보이는 위치에 따라오도록 translateX 동기화
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    let el: HTMLElement | null = panel.parentElement;
    while (el) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') break;
      el = el.parentElement;
    }
    if (!el) return;

    const sync = () => { panel.style.transform = `translateX(${el!.scrollLeft}px)`; };
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    return () => el!.removeEventListener('scroll', sync);
  }, []);

  const realCode   = extractRealCode(projectCode);
  const searchTerm = realCode ?? projectCode;

  const { data, isLoading } = useQuery({
    queryKey: ['finance-by-code', searchTerm],
    queryFn:  () => getProjects(EMPTY_FILTERS, { page: 1, pageSize: 20, search: searchTerm, field: 'project_code' })
      .then(r => r.data),
    staleTime: STALE_5MIN,
    gcTime:    GC_10MIN,
  });

  const rows          = data ?? [];
  const distinctFiles = new Set(rows.map(r => r.filename));
  const isAmbiguous   = !realCode && distinctFiles.size > 1;
  const stageRank     = new Map(sortStages(rows.map(r => r.stage)).map((s, i) => [s, i]));
  const sorted        = [...rows].sort((a, b) => (stageRank.get(a.stage) ?? 99) - (stageRank.get(b.stage) ?? 99));

  return (
    <div ref={panelRef} className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>재무 이력</span>
          <span className={styles.code}>{projectCode}</span>
        </div>
        <Button unstyled className={styles.closeBtn} onClick={onClose} aria-label="닫기">×</Button>
      </div>

      {isLoading ? (
        <div className={styles.center}><Spinner size="sm" fullPage={false} label="" /></div>
      ) : isAmbiguous ? (
        <div className={styles.emptyBox}>
          <span className={styles.emptyIcon}>⚠️</span>
          <strong className={styles.emptyTitle}>특정 불가</strong>
          <span className={styles.emptySub}>이 코드를 {distinctFiles.size}개 파일이 공유합니다 (미확정 코드)</span>
        </div>
      ) : sorted.length === 0 ? (
        <div className={styles.emptyBox}>
          <span className={styles.emptyIcon}>📂</span>
          <strong className={styles.emptyTitle}>재무 데이터 없음</strong>
          <span className={styles.emptySub}>PPT에서 추출된 재무 이력이 없습니다</span>
        </div>
      ) : (
        <div className={styles.cards}>
          {sorted.map((r, i) => (
            <StageCard key={`${r.stage}-${r.year}-${i}`} r={r} />
          ))}
        </div>
      )}
    </div>
  );
};

export default FinanceCrossCheckPanel;
