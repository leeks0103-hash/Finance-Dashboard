import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import { useHeadcount } from '@/hooks/useHeadcount';
import { usePerformanceOptions } from '@/hooks/usePerformanceData';
import { sortParts } from '@/utils/partOrder';
import { stripPartPrefix } from '@/utils';
import styles from './PartHeadcountPanel.module.css';

/** axios 오류 → 서버가 준 문구 */
const errText = (e: unknown): string => {
  const r = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return r || (e instanceof Error ? e.message : '알 수 없는 오류');
};

const MAX_HEADCOUNT = 999;

/**
 * 관리자 > 파트별 인원(2026-10-23). 인원이 자주 바뀌어 원본 엑셀에 없으므로 관리자가 손으로 적는다 —
 * 저장하면 서버(data/headcount.json)에 올라가고, 실적 탭 인당 매출·손익·관리비 차트가 이 값으로 나눠서 모든 사용자에게 보인다.
 * 비워 두면 '미입력'(그 파트는 인당 차트에서 빠짐). 관리자 페이지 섹션과 상단 바 바로가기(모달) 둘 다에서 같은 패널을 씀 —
 * 모달은 제목을 자기가 갖고 있어 hideTitle
 */
const PartHeadcountPanel = ({ hideTitle = false }: { hideTitle?: boolean }) => {
  const { settings, isLoading, save, isSaving, error } = useHeadcount();
  const { data: options } = usePerformanceOptions();

  // 파트 목록 = 실적 파일의 파트 + 이미 저장된 파트(파일에서 사라진 파트도 지우거나 확인할 수 있게)
  const partNames = useMemo(() => {
    const fromFile = (options?.parts ?? []).map(stripPartPrefix);
    return sortParts([...new Set([...fromFile, ...Object.keys(settings.parts)])]);
  }, [options, settings.parts]);

  const fromServer = useMemo(
    () => Object.fromEntries(partNames.map(p => [p, settings.parts[p] != null ? String(settings.parts[p]) : ''])),
    [partNames, settings.parts],
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => { setDraft(fromServer); }, [fromServer]);   // 서버 값이 바뀌면(저장·다른 관리자) 입력칸을 맞춤

  const dirty = partNames.some(p => (draft[p] ?? '') !== fromServer[p]);
  const num = (p: string) => Math.trunc(Number(draft[p])) || 0;
  const total = partNames.reduce((sum, p) => sum + num(p), 0);
  const filled = partNames.filter(p => num(p) > 0).length;

  const setValue = (p: string, v: string) => setDraft(d => ({ ...d, [p]: v }));
  // − / + 버튼 — 0 아래로는 내려가지 않고, 0이 되면 '미입력'(빈 칸)으로
  const step = (p: string, delta: number) => {
    const next = Math.min(MAX_HEADCOUNT, Math.max(0, num(p) + delta));
    setValue(p, next > 0 ? String(next) : '');
  };

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        {!hideTitle && (
          <div className={styles.titleBox}>
            <span className={styles.title}>파트별 인원</span>
            <span className={styles.sub}>실적 탭 인당 매출·손익·관리비 차트의 분모입니다 — 저장하면 모든 사용자에게 바로 반영돼요</span>
          </div>
        )}
        {settings.updated_at && (
          <span className={styles.meta} title="마지막으로 저장한 시각과 관리자">
            마지막 저장 {settings.updated_at.slice(0, 16)}{settings.updated_by ? ` · ${settings.updated_by}` : ''}
          </span>
        )}
      </div>

      {isLoading ? <span className={styles.muted}>불러오는 중…</span> : (
        <div className={styles.grid}>
          {partNames.map(p => {
            const changed = (draft[p] ?? '') !== fromServer[p];
            return (
              <div key={p} className={`${styles.item} ${changed ? styles.itemChanged : ''} ${num(p) > 0 ? '' : styles.itemEmpty}`}>
                <span className={styles.name} title={p}>{p}</span>
                <div className={styles.ctrl}>
                  <Button unstyled className={styles.step} onClick={() => step(p, -1)} disabled={num(p) <= 0}
                    aria-label={`${p} 인원 줄이기`}>−</Button>
                  <input
                    className={styles.input}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_HEADCOUNT}
                    step={1}
                    placeholder="미입력"
                    value={draft[p] ?? ''}
                    onChange={e => setValue(p, e.target.value)}
                    aria-label={`${p} 인원`}
                  />
                  <Button unstyled className={styles.step} onClick={() => step(p, 1)} disabled={num(p) >= MAX_HEADCOUNT}
                    aria-label={`${p} 인원 늘리기`}>+</Button>
                  <span className={styles.unit}>명</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.foot}>
        <div className={styles.summary}>
          <span className={styles.total}>합계 <b>{total}</b>명</span>
          <span className={styles.muted}>{filled}/{partNames.length}개 파트 입력 · 비운 파트는 인당 차트에서 빠짐</span>
        </div>
        <div className={styles.footBtns}>
          <Button variant="ghost" size="sm" disabled={!dirty || isSaving} onClick={() => setDraft(fromServer)}>되돌리기</Button>
          <Button variant="primary" size="sm" loading={isSaving} disabled={!dirty} onClick={() => void save(draft).catch(() => undefined)}>저장</Button>
        </div>
      </div>
      {error ? <span className={styles.error}>저장 실패: {errText(error)}</span> : null}
    </section>
  );
};

export default PartHeadcountPanel;
