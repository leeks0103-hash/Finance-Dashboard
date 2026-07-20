import { useInsights } from '@/hooks/useInsights';
import { InsightComment, Badge, EmptyState } from '@/components/ui';
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
      <div className={styles.title}>💡 재무 인사이트 <span className={styles.sub}>필터 기준 자동 분석</span></div>
      <div className={styles.grid}>
        <div className={styles.comments}>
          <div className={styles.groupTitle}>■ 주요 코멘트</div>
          <div className={styles.commentList}>
            {data.comments.map((c, i) => (
              <InsightComment key={i} type={c.type} icon={c.icon} text={c.text} />
            ))}
          </div>
        </div>
        <div className={styles.lists}>
          <div className={styles.listCard}>
            <div className={styles.groupTitle}>🏆 이익율 상위 프로젝트</div>
            <table className={styles.table}><tbody>
              {data.top.map((r, i) => (
                <tr key={r.project_code}>
                  <td className={styles.rank}>{i + 1}</td>
                  <td>{r.project_code}</td>
                  <td><Badge label={r.part} variant="part" /></td>
                  <td className={styles.rate} style={{ color: 'var(--profit)' }}>{formatRate(r.profit_rate)}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
          <div className={styles.listCard}>
            <div className={styles.groupTitle}>⚠️ 저수익 / 손실 주의</div>
            <table className={styles.table}><tbody>
              {data.risk.map(r => (
                <tr key={r.project_code}>
                  <td>{r.project_code}</td>
                  <td><Badge label={r.part} variant="part" /></td>
                  <td className={styles.rate} style={{ color: r.operating_profit < 0 ? 'var(--loss)' : 'var(--warn)' }}>
                    {r.operating_profit < 0 ? '손실' : formatRate(r.profit_rate)}
                  </td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsightSection;
