import { usePerformanceInsightViewModel } from '@/hooks/viewmodels';
import { InsightComment, InsightListCard, ProjectRankRow, EmptyState } from '@/components/ui';
import styles from './PerformanceInsightSection.module.css';

const PerformanceInsightSection = () => {
  const vm = usePerformanceInsightViewModel();

  if (vm.isLoading) return <div className={styles.skeleton} />;

  if (vm.isEmpty) return (
    <EmptyState icon="💡" title="인사이트 없음" description="분석할 데이터가 충분하지 않습니다." />
  );

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        실적 인사이트
        <span className={styles.sub}>필터 기준 자동 분석</span>
      </div>

      <div className={styles.body}>
        <div className={styles.commentsPane}>
          <div className={styles.paneTitle}>■ 주요 코멘트</div>
          <div className={styles.commentScroll}>
            {vm.comments.map((c, i) => (
              <InsightComment key={c.type + i + c.text.slice(0, 20)} type={c.type} text={c.text} />
            ))}
          </div>
        </div>

        <div className={styles.listsPane}>
          <InsightListCard variant="default">
            <InsightListCard.Title>목표 대비 부진</InsightListCard.Title>
            <InsightListCard.Body>
              {vm.worst.map((r, i) => (
                <ProjectRankRow
                  key={r.key}
                  rank={i + 1}
                  projectCode={r.displayCode}
                  part={r.part}
                  value={r.value}
                  valueColor={r.valueColor}
                  subValue={r.subValue}
                />
              ))}
            </InsightListCard.Body>
          </InsightListCard>

          <InsightListCard variant="risk">
            <InsightListCard.Title>손실 / 저수익</InsightListCard.Title>
            <InsightListCard.Body>
              {vm.risk.map((r, i) => (
                <ProjectRankRow
                  key={r.key}
                  rank={i + 1}
                  projectCode={r.displayCode}
                  part={r.part}
                  value={r.value}
                  valueColor={r.valueColor}
                  subValue={r.subValue}
                />
              ))}
            </InsightListCard.Body>
          </InsightListCard>
        </div>
      </div>
    </div>
  );
};

export default PerformanceInsightSection;
