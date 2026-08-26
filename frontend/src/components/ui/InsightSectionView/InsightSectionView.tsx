import { InsightComment } from '../InsightComment';
import { InsightListCard } from '../InsightListCard';
import { ProjectRankRow } from '../ProjectRankRow';
import { EmptyState } from '../EmptyState';
import type { Comment, InsightListSpec } from '@/types';
import styles from './InsightSectionView.module.css';

interface Props {
  isLoading:    boolean;
  isEmpty:      boolean;
  heading:      string;
  comments:     Comment[];
  lists:        InsightListSpec[];
  onCodeSearch: (code: string) => void;
}

/** 재무/실적현황 인사이트 섹션 공용 레이아웃 — 코멘트 + 순위 리스트 2개, 데이터·라벨만 갈아끼움 */
export const InsightSectionView = ({ isLoading, isEmpty, heading, comments, lists, onCodeSearch }: Props) => {
  if (isLoading) return <div className={styles.skeleton} />;

  if (isEmpty) return (
    <EmptyState icon="💡" title="인사이트 없음" description="분석할 데이터가 충분하지 않습니다." />
  );

  return (
    <div className={styles.sectionGroup}>
      <div className={styles.header}>
        {heading}
        <span className={styles.sub}>필터 기준 자동 분석</span>
      </div>

      <div className={styles.section}>
        <div className={styles.body}>
          <div className={styles.commentsPane}>
            <div className={styles.paneTitle}>■ 주요 코멘트</div>
            <div className={styles.commentScroll}>
              {comments.map((c, i) => (
                <InsightComment
                  key={c.type + i + c.text.slice(0, 20)}
                  type={c.type}
                  text={c.text}
                  projectCode={c.project_code}
                  projectName={c.project_name}
                  onProjectClick={onCodeSearch}
                />
              ))}
            </div>
          </div>

          <div className={styles.listsPane}>
            {lists.map(list => list.plain ? (
              <div key={list.title} className={styles.plainList}>
                <div className={styles.paneTitle}>■ {list.title}</div>
                <div className={styles.plainScroll}>
                  {list.renderList
                    ? list.renderList(list.rows, onCodeSearch)
                    : list.rows.map((r, i) => (
                        <ProjectRankRow
                          key={r.key}
                          rank={i + 1}
                          projectCode={r.displayCode}
                          part={r.part}
                          value={r.value}
                          valueColor={r.valueColor}
                          subValue={r.subValue}
                          onCodeSearch={onCodeSearch}
                        />
                      ))}
                </div>
              </div>
            ) : (
              <InsightListCard key={list.title} variant={list.variant}>
                <InsightListCard.Title>{list.title}</InsightListCard.Title>
                <InsightListCard.Body>
                  {list.rows.map((r, i) => (
                    <ProjectRankRow
                      key={r.key}
                      rank={i + 1}
                      projectCode={r.displayCode}
                      part={r.part}
                      value={r.value}
                      valueColor={r.valueColor}
                      subValue={r.subValue}
                      onCodeSearch={onCodeSearch}
                    />
                  ))}
                </InsightListCard.Body>
              </InsightListCard>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
