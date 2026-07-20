import { useInsights } from '@/hooks/useInsights';
import { InsightComment, InsightListCard, ProjectRankRow, EmptyState } from '@/components/ui';
import { formatRate } from '@/utils';
import styles from './InsightSection.module.css';

const InsightSection = () => {
  const { data, isLoading } = useInsights();

  if (isLoading || !data) return <div className={styles.skeleton} />;

  if (!data.comments.length && !data.top.length) return (
    <EmptyState icon="💡" title="인사이트 없음" description="분석할 데이터가 충분하지 않습니다." />
  );

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        💡 재무 인사이트
        <span className={styles.sub}>필터 기준 자동 분석</span>
      </div>

      <div className={styles.body}>
        {/* 코멘트 — 스크롤 고정 영역 */}
        <div className={styles.commentsPane}>
          <div className={styles.paneTitle}>■ 주요 코멘트</div>
          <div className={styles.commentScroll}>
            {data.comments.map((c, i) => (
              <InsightComment key={i} type={c.type} icon={c.icon} text={c.text} />
            ))}
          </div>
        </div>

        {/* 리스트 카드 — 고정 높이 분할 */}
        <div className={styles.listsPane}>
          <InsightListCard title="🏆 이익율 상위 프로젝트">
            {data.top.map((r, i) => (
              <ProjectRankRow
                key={r.project_code}
                rank={i + 1}
                projectCode={r.project_code}
                part={r.part}
                value={formatRate(r.profit_rate)}
                valueColor="var(--profit)"
              />
            ))}
          </InsightListCard>

          <InsightListCard title="⚠️ 저수익 / 손실 주의">
            {data.risk.map(r => (
              <ProjectRankRow
                key={r.project_code}
                projectCode={r.project_code}
                part={r.part}
                value={r.operating_profit < 0 ? '손실' : formatRate(r.profit_rate)}
                valueColor={r.operating_profit < 0 ? 'var(--loss)' : 'var(--warn)'}
              />
            ))}
          </InsightListCard>
        </div>
      </div>
    </div>
  );
};

export default InsightSection;
