import { useInsightViewModel } from '@/hooks/viewmodels';
import { InsightComment, InsightListCard, ProjectRankRow, EmptyState } from '@/components/ui';
import { useQuickSearchStore } from '@/store/quickSearch.store';
import styles from './InsightSection.module.css';

const InsightSection = () => {
  const vm = useInsightViewModel();
  const setFinanceSearch = useQuickSearchStore(s => s.setFinance);

  if (vm.isLoading) return <div className={styles.skeleton} />;

  if (vm.isEmpty) return (
    <EmptyState icon="💡" title="인사이트 없음" description="분석할 데이터가 충분하지 않습니다." />
  );

  return (
    <div className={styles.sectionGroup}>
      <div className={styles.header}>
        재무 인사이트
        <span className={styles.sub}>필터 기준 자동 분석</span>
      </div>

      <div className={styles.section}>
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
          <InsightListCard variant="profit">
            <InsightListCard.Title>이익율 상위</InsightListCard.Title>
            <InsightListCard.Body>
              {vm.top.map((r, i) => (
                <ProjectRankRow
                  key={r.projectCode}
                  rank={i + 1}
                  projectCode={r.displayCode}
                  part={r.part}
                  value={r.value}
                  valueColor={r.valueColor}
                  subValue={r.subValue}
                  onCodeSearch={setFinanceSearch}
                />
              ))}
            </InsightListCard.Body>
          </InsightListCard>

          <InsightListCard variant="risk">
            <InsightListCard.Title>저수익 / 손실</InsightListCard.Title>
            <InsightListCard.Body>
              {vm.risk.map((r, i) => (
                <ProjectRankRow
                  key={r.projectCode}
                  rank={i + 1}
                  projectCode={r.displayCode}
                  part={r.part}
                  value={r.value}
                  valueColor={r.valueColor}
                  subValue={r.subValue}
                  onCodeSearch={setFinanceSearch}
                />
              ))}
            </InsightListCard.Body>
          </InsightListCard>
        </div>
      </div>
      </div>
    </div>
  );
};

export default InsightSection;
