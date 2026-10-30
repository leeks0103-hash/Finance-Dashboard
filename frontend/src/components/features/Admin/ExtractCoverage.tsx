import { useMemo } from 'react';
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

/** 상태와 별개 표시 — 마지막 추출 뒤에 원본 PPT가 수정된 파일(날짜 비교만, 내용은 안 열어봄) */
const MODIFIED_LABEL = '원본 수정됨';
const MODIFIED_HINT = '마지막으로 추출한 시각보다 원본 PPT의 수정 시각이 늦은 파일 — 내용은 열어 보지 않고 날짜만 비교. 대시보드 숫자가 옛 것일 수 있어 다시 추출 필요';

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

type PickHandler = (files: string[], target: ExtractTarget, on: boolean) => void;

interface ItemListProps {
  items: CoverageItem[];
  /** 체크박스를 달 때만 — 이 카드의 대상(재무/KPI)과 지금 고른 파일, 체크 핸들러 */
  target?: ExtractTarget;
  picked?: ReadonlySet<string>;
  onPick?: PickHandler;
  disabled?: boolean;
}

const ItemList = ({ items, target, picked, onPick, disabled }: ItemListProps) => (
  <ul className={styles.list}>
    {items.map(it => {
      const selectable = !!(onPick && target);
      const isPicked = !!picked?.has(it.file);
      return (
      <li key={it.file} className={`${styles.item} ${selectable ? styles.itemSelectable : ''} ${isPicked ? styles.itemPicked : ''}`}>
        {/* 체크 = 위 'PPT 데이터 추출'의 '선택' 방식에 이 파일을 담음(2026-10-29 요청 — 원본 수정된 파일을 바로 다시 추출) */}
        {selectable && (
          <input type="checkbox" className={styles.check} checked={isPicked} disabled={disabled}
            onChange={() => onPick!([it.file], target!, !isPicked)}
            aria-label={`${it.file} 다시 추출할 파일로 선택`}
            title="체크하면 위 'PPT 데이터 추출'의 선택 방식에 담깁니다" />
        )}
        {/* 추출 뒤에 수정된 파일은 상태 대신 '수정됨' 알약 — 반영된 숫자가 옛 것일 수 있음 */}
        {it.modified
          ? <span className={`${styles.pill} ${styles.pill_modified}`}>{MODIFIED_LABEL}</span>
          : <span className={`${styles.pill} ${styles[`pill_${it.status}`]}`}>{STATUS_LABEL[it.status]}</span>}
        {/* 클릭 = 파일명 복사, ↗ = 원본 열기(폴더에서 찾은 경로라 미처리·실패 파일도 열림) */}
        <span className={styles.file}><CopyText text={it.file} onOpen={openCoverageFileOrAlert} /></span>
        {/* 원본 오류(com_error 등)는 알아보기 어려워 화면엔 안 보이고 마우스 올렸을 때만 */}
        {it.modified
          ? <span className={styles.reason}>{`마지막 추출 ${it.at} → 원본 수정 ${it.modified_at} — 다시 추출하면 최신 숫자가 반영됨`}</span>
          : it.reason && <span className={styles.reason} title={it.detail || undefined}>{it.reason}</span>}
      </li>
      );
    })}
  </ul>
);

interface SourceCardProps {
  src: SourceCoverage;
  /** 이 카드가 재무인지 KPI인지 — 체크한 파일을 추출할 대상으로 같이 켜려고 */
  target: ExtractTarget;
  /** 실패 파일만 다시 추출 — 없으면 버튼 안 그림 */
  onRetryFailed?: () => void;
  retryDisabled?: boolean;
  /** 지금 '선택' 방식에 담긴 파일명 — 있으면 목록에 체크박스(실패·미처리·원본 수정됨 파일만) */
  picked?: ReadonlySet<string>;
  onPick?: PickHandler;
}

const SourceCard = ({ src, target, onRetryFailed, retryDisabled, picked, onPick }: SourceCardProps) => {
  const by = (s: CoverageStatus) => src.items.filter(it => it.status === s);
  // DRM 파일도 포함 — 누가 원본을 고쳤을 수 있어 시도는 해봄(추출 스크립트가 원본 대신 로컬 사본을 엶)
  const retriable = by('failed').length;
  const c = src.counts;
  const total = src.folder_files || 1;
  const pct = Math.round((c.extracted / total) * 1000) / 10;
  // 추출 뒤 원본이 수정된 파일 — 상태와 별개(실패·미처리는 제외하고 셈, 서버 modified_count와 같음)
  const modifiedItems = src.items.filter(it => it.modified);
  const modifiedFiles = modifiedItems.map(it => it.file);
  const allModifiedPicked = modifiedFiles.length > 0 && modifiedFiles.every(f => picked?.has(f));
  const needCheck = c.failed + c.pending + modifiedItems.length;
  const allOk = needCheck === 0;
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.srcLabel}>{src.label}</span>
        <span className={`${styles.stateBadge} ${allOk ? styles.stateOk : styles.stateWarn}`}>
          {allOk ? '이상 없음' : `확인 필요 ${needCheck}건`}
        </span>
        {/* 원본 수정된 파일을 한 번에 담기/빼기 — 하나씩 체크하지 않아도 됨 */}
        {onPick && modifiedFiles.length > 0 && (
          <Button variant="ghost" size="sm" className={styles.retryBtn} disabled={retryDisabled}
            onClick={() => onPick(modifiedFiles, target, !allModifiedPicked)}
            title="원본이 수정된 파일을 위 'PPT 데이터 추출'의 선택 방식에 한꺼번에 담거나 뺍니다">
            {allModifiedPicked ? `수정된 ${modifiedFiles.length}개 선택 해제` : `수정된 ${modifiedFiles.length}개 모두 선택`}
          </Button>
        )}
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
        {/* 상태 막대와 별개 — 파일 수가 겹쳐 세지 않게 막대엔 안 넣고 범례 끝에만 */}
        <span className={`${styles.legendItem} ${modifiedItems.length ? '' : styles.legendZero}`} title={MODIFIED_HINT}>
          <i className={`${styles.dot} ${styles.seg_modified}`} />
          {MODIFIED_LABEL} <b>{modifiedItems.length}</b>
        </span>
      </div>

      <div className={styles.meta}>
        대시보드에 들어간 줄 {src.rows_total}개
        <span className={styles.metaHint}> — 보고서 한 개에서 단계별로 여러 줄이 나올 수 있어 파일 수와 달라도 정상</span>
      </div>

      {!src.excel_ok && <div className={styles.warn}>추출 결과 파일을 읽지 못했습니다(보안 암호화 등) — 아래 숫자가 비어 있을 수 있음</div>}
      {src.duplicate_names > 0 && (
        <div className={styles.warn}>이름이 똑같은 파일이 다른 폴더에 또 있음 {src.duplicate_names}개 — 서로 구분이 안 돼 한쪽만 반영될 수 있음</div>
      )}

      {/* 펼쳐 두는 목록 = 실패·미처리 + 추출 뒤 수정된 파일(수정된 건 아래 접힌 목록엔 안 넣어 겹치지 않게) */}
      {(OPEN_GROUPS.some(s => by(s).length > 0) || modifiedItems.length > 0) && (
        <ItemList items={[...OPEN_GROUPS.flatMap(by), ...modifiedItems]}
          target={target} picked={picked} onPick={onPick} disabled={retryDisabled} />
      )}
      {FOLDED_GROUPS.map(s => {
        const rest = by(s).filter(it => !it.modified);
        return rest.length > 0 && (
          <details key={s} className={styles.details}>
            <summary>{STATUS_LABEL[s]} {rest.length}건 보기</summary>
            <p className={styles.groupHint}>{STATUS_HINT[s]}</p>
            <ItemList items={rest} />
          </details>
        );
      })}
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
  /** 위 '선택' 방식에 담긴 파일명 + 목록 체크 핸들러 — 둘 다 있으면 실패·미처리·원본 수정됨 파일에 체크박스(2026-10-29) */
  selectedFiles?: string[];
  onPick?: PickHandler;
  onClearSelected?: () => void;
  /** 담긴 파일을 바로 다시 추출(확인창은 호출하는 쪽에서) */
  onRunSelected?: () => void;
}

/**
 * 추출 현황 — "폴더에 N개 있는데 몇 개가 실제로 들어갔고, 안 된 건 무엇이며 왜인지"(2026-10-01 요청).
 * 파일 수와 취합 행 수를 섞어 "260개"처럼 오판하지 않게 둘을 나눠 보여줌. 디버깅용으로도 씀
 */
const ExtractCoverage = ({ finishedAt, onRetryFailed, retryDisabled, selectedFiles, onPick, onClearSelected, onRunSelected }: Props) => {
  const { data, isLoading, isFetching, refresh } = useExtractCoverage(true, finishedAt);
  const picked = useMemo(() => new Set(selectedFiles ?? []), [selectedFiles]);
  const pickedCount = selectedFiles?.length ?? 0;

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
          {data.finance && <SourceCard src={data.finance} target="finance" retryDisabled={retryDisabled}
            picked={picked} onPick={onPick}
            onRetryFailed={onRetryFailed && (() => onRetryFailed('finance'))} />}
          {data.kpi && <SourceCard src={data.kpi} target="kpi" retryDisabled={retryDisabled}
            picked={picked} onPick={onPick}
            onRetryFailed={onRetryFailed && (() => onRetryFailed('kpi'))} />}
        </div>
      )}
      {/* 담긴 파일이 있으면 아래에 따라다니는 바 — 스크롤해서 위로 올라갈 필요 없이 여기서 바로 다시 추출 */}
      {onRunSelected && pickedCount > 0 && (
        <div className={styles.pickBar} role="region" aria-label="선택한 파일 다시 추출">
          <span className={styles.pickText}>
            <b>{pickedCount}개</b> 선택됨 <span className={styles.pickHint}>— 위 'PPT 데이터 추출'의 선택 방식과 같은 목록</span>
          </span>
          <Button variant="ghost" size="sm" disabled={retryDisabled} onClick={onClearSelected}>선택 해제</Button>
          <Button variant="primary" size="sm" disabled={retryDisabled} onClick={onRunSelected}>
            선택한 {pickedCount}개 다시 추출
          </Button>
        </div>
      )}
    </section>
  );
};

export default ExtractCoverage;
