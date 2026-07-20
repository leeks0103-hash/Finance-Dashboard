import { useInsights } from '../../../hooks/useInsights';
import InsightComment from '../../ui/InsightComment';
import Badge from '../../ui/Badge';
import { formatRate } from '../../../utils/format';
import styles from './InsightSection.module.css';

const InsightSection = () => {
  const { data } = useInsights();
  if (!data) return null;

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
            <table className={styles.table}>
              <tbody>
                {data.top.map((r, i) => (
                  <tr key={r.project_code}>
                    <td className={styles.rank}>{i + 1}</td>
                    <td>{r.project_code}</td>
                    <td><Badge label={r.part} variant="part" /></td>
                    <td className={styles.rate} style={{ color: 'var(--profit)' }}>{formatRate(r.profit_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.listCard}>
            <div className={styles.groupTitle}>⚠️ 저수익 / 손실 주의</div>
            <table className={styles.table}>
              <tbody>
                {data.risk.map(r => (
                  <tr key={r.project_code}>
                    <td>{r.project_code}</td>
                    <td><Badge label={r.part} variant="part" /></td>
                    <td className={styles.rate} style={{ color: r.operating_profit < 0 ? 'var(--loss)' : 'var(--warn)' }}>
                      {r.operating_profit < 0 ? '손실' : formatRate(r.profit_rate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default InsightSection;
