import { Button } from '@/components/ui';
import { useExtractCoverage } from '@/hooks/useExtractCoverage';
import type { CoverageItem, CoverageStatus, SourceCoverage } from '@/types/extract.types';
import styles from './ExtractCoverage.module.css';

const STATUS_LABEL: Record<CoverageStatus, string> = {
  extracted: '추출됨',
  merged:    '다른 파일로 합쳐짐',
  no_table:  '표 없음',
  failed:    '실패',
  pending:   '미처리',
};

/** 상태 설명 — 범례에 마우스를 올리면 툴팁으로 */
const STATUS_HINT: Record<CoverageStatus, string> = {
  extracted: '취합 시트에 이 파일 이름으로 행이 들어감',
  merged:    '행은 뽑았지만 같은 (코드/연도/단계) 행을 다른 파일(보통 같은 프로젝트의 다음 단계 보고서)이 덮어써 그 파일 이름으로 남음 — 데이터 손실 아님',
  no_table:  '열어 봤지만 재무/KPI 표가 없는 PPT(양식 밖 보고서 등)',
  failed:    '파일을 열지 못함 — 원인과 조치는 목록 참고',
  pending:   '아직 한 번도 처리 안 됨 — 다음 추출 때 처리됨',
};

// 막대·범례 순서 — 왼쪽부터 정상 → 확인 필요
const ORDER: CoverageStatus[] = ['extracted', 'merged', 'no_table', 'pending', 'failed'];
/** 바로 손봐야 하는 것(실패·미처리)은 펼쳐 두고, 정상일 수 있는 것(표 없음·합쳐짐)은 접어 둠 */
const OPEN_GROUPS: CoverageStatus[] = ['failed', 'pending'];
const FOLDED_GROUPS: CoverageStatus[] = ['no_table', 'merged'];

const RefreshIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
    <path d="M13.5 2.5v3.2h-3.2" />
  </svg>
);

const ItemList = ({ items }: { items: CoverageItem[] }) => (
  <ul className={styles.list}>
    {items.map(it => (
      <li key={it.file} className={styles.item}>
        <span className={`${styles.pill} ${styles[`pill_${it.status}`]}`}>{STATUS_LABEL[it.status]}</span>
        <span className={styles.file}>{it.file}</span>
        {it.reason && <span className={styles.reason}>{it.reason}</span>}
      </li>
    ))}
  </ul>
);

const SourceCard = ({ src }: { src: SourceCoverage }) => {
  const by = (s: CoverageStatus) => src.items.filter(it => it.status === s);
  const c = src.counts;
  const total = src.folder_files || 1;
  const pct = Math.round((c.extracted / total) * 1000) / 10;
  const allOk = c.failed === 0 && c.pending === 0;
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.srcLabel}>{src.label}</span>
        <span className={`${styles.stateBadge} ${allOk ? styles.stateOk : styles.stateWarn}`}>
          {allOk ? '이상 없음' : `확인 필요 ${c.failed + c.pending}건`}
        </span>
      </div>

      <div className={styles.figure}>
        <span className={styles.big}>{c.extracted}</span>
        <span className={styles.of}>/ {src.folder_files}개 파일 추출</span>
        <span className={styles.pct}>{pct}%</span>
      </div>

      {/* 파일 상태 비율 막대 — 한눈에 얼마나 들어갔는지 */}
      <div className={styles.bar} role="img" aria-label={ORDER.map(s => `${STATUS_LABEL[s]} ${c[s]}`).join(', ')}>
        {ORDER.map(s => c[s] > 0 && (
          <span key={s} className={styles[`seg_${s}`]} style={{ flexGrow: c[s] }} title={`${STATUS_LABEL[s]} ${c[s]}개`} />
        ))}
      </div>

      <div className={styles.legend}>
        {ORDER.map(s => (
          <span key={s} className={`${styles.legendItem} ${c[s] ? '' : styles.legendZero}`} title={STATUS_HINT[s]}>
            <i className={`${styles.dot} ${styles[`seg_${s}`]}`} />
            {STATUS_LABEL[s]} <b>{c[s]}</b>
          </span>
        ))}
      </div>

      <div className={styles.meta}>
        취합 시트 {src.rows_total}행
        <span className={styles.metaHint}> — 한 파일에서 보고단계별로 여러 행이 나와 파일 수와 다른 게 정상</span>
      </div>

      {!src.excel_ok && <div className={styles.warn}>결과 엑셀을 읽지 못했습니다(암호화 등) — 숫자가 비어 있을 수 있음</div>}
      {src.duplicate_names > 0 && (
        <div className={styles.warn}>하위 폴더 여러 곳에 같은 이름 파일 {src.duplicate_names}개 — 결과 엑셀에선 구분 안 됨</div>
      )}

      {OPEN_GROUPS.some(s => by(s).length > 0) && <ItemList items={OPEN_GROUPS.flatMap(by)} />}
      {FOLDED_GROUPS.map(s => by(s).length > 0 && (
        <details key={s} className={styles.details}>
          <summary>{STATUS_LABEL[s]} {by(s).length}건 보기</summary>
          <ItemList items={by(s)} />
        </details>
      ))}
      {src.orphans.length > 0 && (
        <details className={styles.details}>
          <summary>폴더엔 없는데 결과에 남은 파일 {src.orphans.length}건</summary>
          <ul className={styles.list}>
            {src.orphans.map(f => <li key={f} className={styles.item}><span className={styles.file}>{f}</span></li>)}
          </ul>
        </details>
      )}
    </div>
  );
};

interface Props {
  /** 마지막 추출이 끝난 시각 — 바뀌면 현황을 다시 셈 */
  finishedAt: string | null | undefined;
}

/**
 * 추출 현황 — "폴더에 N개 있는데 몇 개가 실제로 들어갔고, 안 된 건 무엇이며 왜인지"(2026-10-01 요청).
 * 파일 수와 취합 행 수를 섞어 "260개"처럼 오판하지 않게 둘을 나눠 보여줌. 디버깅용으로도 씀
 */
const ExtractCoverage = ({ finishedAt }: Props) => {
  const { data, isLoading, isFetching, refresh } = useExtractCoverage(true, finishedAt);

  return (
    <section className={styles.wrap}>
      <div className={styles.top}>
        <div className={styles.titleBox}>
          <span className={styles.title}>추출 현황</span>
          <span className={styles.sub}>
            원본 폴더 대비 실제로 들어간 파일{data?.scanned_at ? ` · ${data.scanned_at} 기준` : ''}
          </span>
        </div>
        {/* 다른 버튼(실행)과 같은 primary — 혼자 ghost라 색이 달라 보였음 */}
        <Button variant="primary" size="sm" icon={<RefreshIcon />} loading={isFetching} onClick={() => { void refresh(); }}
          title="원본 폴더를 다시 훑어 파일 수와 추출 상태를 새로 셉니다">
          다시 세기
        </Button>
      </div>
      {isLoading && <div className={styles.loading}>원본 폴더를 세는 중…</div>}
      {data && !data.ok && <div className={styles.warn}>{data.error}</div>}
      {data?.ok && (
        <div className={styles.cards}>
          {data.finance && <SourceCard src={data.finance} />}
          {data.kpi && <SourceCard src={data.kpi} />}
        </div>
      )}
    </section>
  );
};

export default ExtractCoverage;
