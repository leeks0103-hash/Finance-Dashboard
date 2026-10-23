import { Button, CopyText } from '@/components/ui';
import { useExtractCoverage } from '@/hooks/useExtractCoverage';
import { openCoverageFileOrAlert } from '@/hooks/useOpenFile';
import type { CoverageItem, CoverageStatus, ExtractTarget, SourceCoverage } from '@/types/extract.types';
import styles from './ExtractCoverage.module.css';

const STATUS_LABEL: Record<CoverageStatus, string> = {
  extracted: '반영됨',
  merged:    '다른 보고서로 반영',
  no_table:  '표 없음',
  failed:    '열기 실패',
  pending:   '아직 안 읽음',
};

/** 상태 설명 — 범례에 마우스를 올리면 툴팁으로 */
const STATUS_HINT: Record<CoverageStatus, string> = {
  extracted: '이 파일의 숫자가 대시보드에 들어가 있음',
  merged:    '다음 단계 보고서(예: 제안 → 착수)의 표에도 이 단계 숫자가 같이 들어 있어, 대시보드엔 그 다음 보고서 쪽 숫자로 들어가 있음 — 빠진 데이터 아님(두 보고서 숫자가 다르면 다음 보고서 숫자가 쓰임)',
  no_table:  '파일은 열었지만 재무/KPI 표가 없어 가져올 숫자가 없음(보고서 양식이 아닌 자료 등) — 문제 아님',
  failed:    '파일을 열지 못해 숫자를 못 가져옴 — 이유와 할 일은 목록 참고',
  pending:   '새로 들어와 아직 한 번도 읽지 않은 파일 — 다음 추출 때 읽음',
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
        {/* 클릭 = 파일명 복사, ↗ = 원본 열기(폴더에서 찾은 경로라 미처리·실패 파일도 열림) */}
        <span className={styles.file}><CopyText text={it.file} onOpen={openCoverageFileOrAlert} /></span>
        {/* 원본 오류(com_error 등)는 알아보기 어려워 화면엔 안 보이고 마우스 올렸을 때만 */}
        {it.reason && <span className={styles.reason} title={it.detail || undefined}>{it.reason}</span>}
      </li>
    ))}
  </ul>
);

interface SourceCardProps {
  src: SourceCoverage;
  /** 실패 파일만 다시 추출 — 없으면 버튼 안 그림 */
  onRetryFailed?: () => void;
  retryDisabled?: boolean;
}

const SourceCard = ({ src, onRetryFailed, retryDisabled }: SourceCardProps) => {
  const by = (s: CoverageStatus) => src.items.filter(it => it.status === s);
  // DRM 파일도 포함 — 누가 원본을 고쳤을 수 있어 시도는 해봄(추출 스크립트가 원본 대신 로컬 사본을 엶)
  const retriable = by('failed').length;
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
        {onRetryFailed && retriable > 0 && (
          <Button variant="primary" size="sm" className={styles.retryBtn} disabled={retryDisabled} onClick={onRetryFailed}
            title="실패한 파일만 다시 추출합니다">
            실패 {retriable}개 다시 추출
          </Button>
        )}
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
        대시보드에 들어간 줄 {src.rows_total}개
        <span className={styles.metaHint}> — 보고서 한 개에서 단계별로 여러 줄이 나올 수 있어 파일 수와 달라도 정상</span>
      </div>

      {!src.excel_ok && <div className={styles.warn}>추출 결과 파일을 읽지 못했습니다(보안 암호화 등) — 아래 숫자가 비어 있을 수 있음</div>}
      {src.duplicate_names > 0 && (
        <div className={styles.warn}>이름이 똑같은 파일이 다른 폴더에 또 있음 {src.duplicate_names}개 — 서로 구분이 안 돼 한쪽만 반영될 수 있음</div>
      )}

      {OPEN_GROUPS.some(s => by(s).length > 0) && <ItemList items={OPEN_GROUPS.flatMap(by)} />}
      {FOLDED_GROUPS.map(s => by(s).length > 0 && (
        <details key={s} className={styles.details}>
          <summary>{STATUS_LABEL[s]} {by(s).length}건 보기</summary>
          <p className={styles.groupHint}>{STATUS_HINT[s]}</p>
          <ItemList items={by(s)} />
        </details>
      ))}
      {src.orphans.length > 0 && (
        <details className={styles.details}>
          <summary>지워졌거나 이름이 바뀐 파일 {src.orphans.length}건</summary>
          <p className={styles.groupHint}>
            원본 폴더에서는 없어졌는데(삭제·이름 변경) 예전에 읽은 숫자가 아직 대시보드에 남아 있는 파일입니다.
            다음 추출 때 자동으로 정리됩니다.
          </p>
          <ul className={styles.list}>
            {/* 폴더에 없는 파일이라 열기(↗)는 없음 — 복사만 */}
            {src.orphans.map(f => <li key={f} className={styles.item}><span className={styles.file}><CopyText text={f} /></span></li>)}
          </ul>
        </details>
      )}
    </div>
  );
};

interface Props {
  /** 마지막 추출이 끝난 시각 — 바뀌면 현황을 다시 셈 */
  finishedAt: string | null | undefined;
  /** 실패 파일만 다시 추출(확인창은 호출하는 쪽에서) */
  onRetryFailed?: (target: ExtractTarget) => void;
  /** 추출 실행 중이면 버튼 막음 */
  retryDisabled?: boolean;
}

/**
 * 추출 현황 — "폴더에 N개 있는데 몇 개가 실제로 들어갔고, 안 된 건 무엇이며 왜인지"(2026-10-01 요청).
 * 파일 수와 취합 행 수를 섞어 "260개"처럼 오판하지 않게 둘을 나눠 보여줌. 디버깅용으로도 씀
 */
const ExtractCoverage = ({ finishedAt, onRetryFailed, retryDisabled }: Props) => {
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
          {data.finance && <SourceCard src={data.finance} retryDisabled={retryDisabled}
            onRetryFailed={onRetryFailed && (() => onRetryFailed('finance'))} />}
          {data.kpi && <SourceCard src={data.kpi} retryDisabled={retryDisabled}
            onRetryFailed={onRetryFailed && (() => onRetryFailed('kpi'))} />}
        </div>
      )}
    </section>
  );
};

export default ExtractCoverage;
