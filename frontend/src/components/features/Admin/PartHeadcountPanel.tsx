import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import { useHeadcount } from '@/hooks/useHeadcount';
import { usePerformanceOptions } from '@/hooks/usePerformanceData';
import { sortParts } from '@/utils/partOrder';
import { stripPartPrefix, roundHeadcount, formatHeadcount } from '@/utils';
import styles from './PartHeadcountPanel.module.css';

/** axios 오류 → 서버가 준 문구 */
const errText = (e: unknown): string => {
  const r = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return r || (e instanceof Error ? e.message : '알 수 없는 오류');
};

// 파트 한 개당 상한(명) — 서버 headcount.HEADCOUNT_MAX와 같게(2026-10-27 999 → 100)
const MAX_HEADCOUNT = 100;
// ± 버튼 한 번에 움직이는 양(명) — 소수 첫째 자리 단위(2026-10-27, 예전 1명씩)
const STEP = 0.1;

// 계획 인원 입력 박스 주석 처리(2026-10-27) — 복구 시 Kind에 'plan' 추가, 아래 '계획 인원' 주석들을 해제
// type Kind = 'plan' | 'cur';
type Kind = 'cur';
type Draft = Record<Kind, Record<string, string>>;

// 인원은 소수 첫째 자리까지(2026-10-27 — 파트타임·겸임 0.5명 등). 둘째 자리 이하는 버림, 숫자가 아니면 0
const toNum = (v: string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n * 10 + 1e-9) / 10 : 0;
};

interface StepperProps {
  label: string;
  part: string;
  value: string;
  onChange: (v: string) => void;
}

/** [현재] − 값 + 명 한 묶음 — ± 버튼은 0.1씩, 입력칸에서도 소수 첫째 자리까지 직접 입력(상한 초과로 적으면 상한으로 맞춤) */
const Stepper = ({ label, part, value, onChange }: StepperProps) => {
  const n = toNum(value);
  // − / + 버튼 — 0 아래로는 내려가지 않고, 0이 되면 '미입력'(빈 칸)으로
  const step = (delta: number) => {
    const next = Math.min(MAX_HEADCOUNT, Math.max(0, roundHeadcount(n + delta)));
    onChange(next > 0 ? String(next) : '');
  };
  return (
    <div className={styles.ctrl}>
      <Button unstyled className={styles.step} onClick={() => step(-STEP)} disabled={n <= 0}
        aria-label={`${part} ${label} 인원 줄이기`}>−</Button>
      <input
        className={styles.input}
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_HEADCOUNT}
        step={STEP}
        placeholder="미입력"
        value={value}
        onChange={e => onChange(toNum(e.target.value) > MAX_HEADCOUNT ? String(MAX_HEADCOUNT) : e.target.value)}
        aria-label={`${part} ${label} 인원`}
      />
      <Button unstyled className={styles.step} onClick={() => step(STEP)} disabled={n >= MAX_HEADCOUNT}
        aria-label={`${part} ${label} 인원 늘리기`}>+</Button>
      <span className={styles.unit}>명</span>
    </div>
  );
};

/**
 * 관리자 > 파트별 인원(2026-10-23). 인원이 자주 바뀌어 원본 엑셀에 없으므로 관리자가 손으로 적는다 —
 * 현재 인원(인당 추정 매출·손익·관리비의 분모). 계획 인원 입력은 2026-10-27 주석 처리(서버에 저장된 계획 인원은 그대로 유지).
 * 저장하면 서버(data/headcount.json)에 올라가고 모든 사용자에게 보인다. 비워 두면 '미입력'.
 * 관리자 페이지 섹션과 상단 바 바로가기(모달) 둘 다에서 같은 패널을 씀 — 모달은 제목을 자기가 갖고 있어 hideTitle
 */
const PartHeadcountPanel = ({ hideTitle = false }: { hideTitle?: boolean }) => {
  const { settings, isLoading, save, isSaving, error } = useHeadcount();
  const { data: options } = usePerformanceOptions();

  // 파트 목록 = 실적 파일의 파트 + 이미 저장된 파트(파일에서 사라진 파트도 지우거나 확인할 수 있게)
  const partNames = useMemo(() => {
    const fromFile = (options?.parts ?? []).map(stripPartPrefix);
    // return sortParts([...new Set([...fromFile, ...Object.keys(settings.parts), ...Object.keys(settings.plan_parts ?? {})])]);   // 계획 인원 주석 처리(2026-10-27)
    return sortParts([...new Set([...fromFile, ...Object.keys(settings.parts)])]);
  }, [options, settings.parts]);

  const fromServer = useMemo<Draft>(() => {
    const str = (m: Record<string, number>) => Object.fromEntries(partNames.map(p => [p, m[p] != null ? String(m[p]) : '']));
    // return { plan: str(settings.plan_parts ?? {}), cur: str(settings.parts) };   // 계획 인원 주석 처리(2026-10-27)
    return { cur: str(settings.parts) };
  }, [partNames, settings.parts]);
  const [draft, setDraft] = useState<Draft>(fromServer);
  useEffect(() => { setDraft(fromServer); }, [fromServer]);   // 서버 값이 바뀌면(저장·다른 관리자) 입력칸을 맞춤

  const val = (k: Kind, p: string) => draft[k][p] ?? '';
  const isChanged = (k: Kind, p: string) => val(k, p) !== fromServer[k][p];
  // const dirty = partNames.some(p => isChanged('plan', p) || isChanged('cur', p));   // 계획 인원 주석 처리(2026-10-27)
  const dirty = partNames.some(p => isChanged('cur', p));
  const sum = (k: Kind) => roundHeadcount(partNames.reduce((t, p) => t + toNum(val(k, p)), 0));
  const filled = (k: Kind) => partNames.filter(p => toNum(val(k, p)) > 0).length;

  const setValue = (k: Kind, p: string, v: string) => setDraft(d => ({ ...d, [k]: { ...d[k], [p]: v } }));

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        {!hideTitle && (
          <div className={styles.titleBox}>
            <span className={styles.title}>파트별 인원</span>
            <span className={styles.sub}>현재 인원은 인당 추정 매출·손익·관리비의 분모입니다 — 저장하면 모든 사용자에게 바로 반영돼요</span>
          </div>
        )}
        {settings.updated_at && (
          <span className={styles.meta} title="마지막으로 저장한 시각과 관리자">
            마지막 저장 {settings.updated_at.slice(0, 16)}{settings.updated_by ? ` · ${settings.updated_by}` : ''}
          </span>
        )}
      </div>

      {isLoading ? <span className={styles.muted}>불러오는 중…</span> : (
        <div className={styles.boxes}>
          {([
            // { k: 'plan' as Kind, title: '계획 인원', desc: '인당 계획 매출의 분모' },   // 주석 처리(2026-10-27)
            { k: 'cur' as Kind, title: '현재 인원', desc: '인당 추정 매출·손익·관리비의 분모' },
          ]).map(box => (
            <div key={box.k} className={styles.box}>
              <div className={styles.boxHead}>
                <div className={styles.boxTitleBox}>
                  <span className={styles.boxTitle}>{box.title}</span>
                  <span className={styles.boxDesc}>{box.desc}</span>
                </div>
                <div className={styles.boxTotal}>
                  <span className={styles.total}>합계 <b>{formatHeadcount(sum(box.k))}</b>명</span>
                  <span className={styles.muted}>{filled(box.k)}/{partNames.length}개 입력</span>
                </div>
              </div>
              <div className={styles.list}>
                {partNames.map(p => {
                  const label = box.title;
                  return (
                    <div key={p} className={`${styles.item} ${isChanged(box.k, p) ? styles.itemChanged : ''} ${toNum(val(box.k, p)) > 0 ? '' : styles.itemEmpty}`}>
                      <span className={styles.name} title={p}>{p}</span>
                      <Stepper label={label} part={p} value={val(box.k, p)} onChange={v => setValue(box.k, p, v)} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.foot}>
        <div className={styles.summary}>
          <span className={styles.muted}>현재 인원을 비운 파트는 인당 차트에서 빠집니다</span>
        </div>
        <div className={styles.footBtns}>
          <Button variant="ghost" size="sm" disabled={!dirty || isSaving} onClick={() => setDraft(fromServer)}>되돌리기</Button>
          <Button variant="primary" size="sm" loading={isSaving} disabled={!dirty}
            // plan_parts를 안 보내면 서버가 저장돼 있던 계획 인원을 그대로 유지함(app.py) — 계획 인원 주석 처리(2026-10-27)
            onClick={() => void save({ parts: draft.cur }).catch(() => undefined)}>저장</Button>
        </div>
      </div>
      {error ? <span className={styles.error}>저장 실패: {errText(error)}</span> : null}
    </section>
  );
};

export default PartHeadcountPanel;
