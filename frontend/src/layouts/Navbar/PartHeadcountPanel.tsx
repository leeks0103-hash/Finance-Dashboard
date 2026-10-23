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

/**
 * 관리자 기능 > 파트별 인원(2026-10-23). 인원이 자주 바뀌어 원본 엑셀에 없으므로 관리자가 손으로 적는다 —
 * 저장하면 서버(data/headcount.json)에 올라가고, 실적 탭 인당 매출·손익·관리비 차트가 이 값으로 나눠서 모든 사용자에게 보인다.
 * 비워 두면 '미입력'(그 파트는 인당 차트에서 빠짐)
 */
const PartHeadcountPanel = () => {
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
  const total = partNames.reduce((sum, p) => sum + (Math.trunc(Number(draft[p])) || 0), 0);

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.title}>파트별 인원 (인당 매출·손익·관리비 계산용)</span>
        {settings.updated_at && (
          <span className={styles.meta} title="마지막으로 저장한 시각과 관리자">
            {settings.updated_at}{settings.updated_by ? ` · ${settings.updated_by}` : ''}
          </span>
        )}
      </div>

      {isLoading ? <span className={styles.muted}>불러오는 중…</span> : (
        <div className={styles.grid}>
          {partNames.map(p => (
            <label key={p} className={styles.item}>
              <span className={styles.name}>{p}</span>
              <input
                className={`${styles.input} ${(draft[p] ?? '') !== fromServer[p] ? styles.changed : ''}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={999}
                step={1}
                placeholder="미입력"
                value={draft[p] ?? ''}
                onChange={e => setDraft(d => ({ ...d, [p]: e.target.value }))}
                aria-label={`${p} 인원`}
              />
              <span className={styles.unit}>명</span>
            </label>
          ))}
        </div>
      )}

      <div className={styles.foot}>
        <span className={styles.muted}>합계 {total}명 · 비우면 미입력(그 파트는 인당 차트에서 제외)</span>
        <Button variant="ghost" size="sm" disabled={!dirty || isSaving} onClick={() => setDraft(fromServer)}>되돌리기</Button>
        <Button variant="primary" size="sm" loading={isSaving} disabled={!dirty} onClick={() => void save(draft).catch(() => undefined)}>저장</Button>
      </div>
      {error ? <span className={styles.error}>저장 실패: {errText(error)}</span> : null}
    </section>
  );
};

export default PartHeadcountPanel;
