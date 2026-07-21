import { useInsightViewModel } from '@/hooks/viewmodels';
import { InsightComment, InsightListCard, ProjectRankRow, EmptyState, Button } from '@/components/ui';
import styles from './InsightSection.module.css';

const InsightSection = () => {
  const vm = useInsightViewModel();

  if (vm.isLoading) return <div className={styles.skeleton} />;

  if (vm.isEmpty) return (
    <EmptyState icon="💡" title="인사이트 없음" description="분석할 데이터가 충분하지 않습니다." />
  );

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        재무 인사이트
        <span className={styles.sub}>필터 기준 자동 분석</span>
      </div>

      <div className={styles.body}>
        <div className={styles.commentsPane}>
          <div className={styles.paneTitle}>■ 주요 코멘트</div>
          <div className={styles.commentScroll}>
            {vm.comments.map((c, i) => (
              <InsightComment key={i} type={c.type} icon={c.icon} text={c.text} />
            ))}
          </div>
          {vm.hasMoreComments && (
            <Button
              variant="ghost"
              size="sm"
              onClick={vm.toggleShowAll}
              className={styles.moreBtn}
            >
              {vm.toggleLabel}
            </Button>
          )}
        </div>

        <div className={styles.listsPane}>
          <InsightListCard title="이익율 상위 프로젝트">
            {vm.top.map((r, i) => (
              <ProjectRankRow
                key={r.projectCode}
                rank={i + 1}
                projectCode={r.displayCode}
                part={r.part}
                value={r.value}
                valueColor={r.valueColor}
              />
            ))}
          </InsightListCard>

          <InsightListCard title="저수익 / 손실 주의">
            {vm.risk.map((r, i) => (
              <ProjectRankRow
                key={r.projectCode}
                rank={i + 1}
                projectCode={r.displayCode}
                part={r.part}
                value={r.value}
                valueColor={r.valueColor}
              />
            ))}
          </InsightListCard>
        </div>
      </div>
    </div>
  );
};

export default InsightSection;
