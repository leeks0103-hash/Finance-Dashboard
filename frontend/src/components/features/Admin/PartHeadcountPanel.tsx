import { useEffect, useMemo, useState } from 'react';
import { Button, FilterChip, confirmDialog } from '@/components/ui';
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
// 연도별로 따로 입력(2026-10-29): cur = 2026 현재 인원(실적 보기 인당 분모), y27 = 2027 인원(2027 계획 보기 인당 분모)
type Kind = 'cur' | 'y27';
type Draft = Record<Kind, Record<string, string>>;

const KIND_INFO: Record<Kind, { chip: string; title: string; desc: string; empty: string }> = {
  cur: { chip: '2026년 인원', title: '2026년 인원', desc: '2026 실적 보기 — 인당 추정 매출·손익·관리비의 분모',
         empty: '2026 인원을 비운 파트는 2026 실적 보기의 인당 차트에서 빠집니다' },
  y27: { chip: '2027년 인원', title: '2027년 인원', desc: '2027 계획 보기 — 인당 매출·관리비·손익(27 계획 금액)의 분모',
         empty: '2027 인원을 비운 파트는 2027 계획 보기의 인당 차트에서 빠집니다(2026 인원으로 대신하지 않음)' },
};

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
        aria-label={`${part} ${label} 줄이기`}>−</Button>
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
        aria-label={`${part} ${label}`}
      />
      <Button unstyled className={styles.step} onClick={() => step(STEP)} disabled={n >= MAX_HEADCOUNT}
        aria-label={`${part} ${label} 늘리기`}>+</Button>
      <span className={styles.unit}>명</span>
    </div>
  );
};

/**
 * 관리자 > 파트별 인원(2026-10-23). 인원이 자주 바뀌어 원본 엑셀에 없으므로 관리자가 손으로 적는다 —
 * 2026 인원(실적 보기 인당 추정 매출·손익·관리비의 분모)과 2027 인원(2027 계획 보기 인당 값의 분모)을 연도별로 따로(2026-10-29).
 * 계획 인원 입력은 2026-10-27 주석 처리(서버에 저장된 계획 인원은 그대로 유지).
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
    return sortParts([...new Set([...fromFile, ...Object.keys(settings.parts), ...Object.keys(settings.parts27 ?? {})])]);
  }, [options, settings.parts, settings.parts27]);

  const fromServer = useMemo<Draft>(() => {
    const str = (m: Record<string, number>) => Object.fromEntries(partNames.map(p => [p, m[p] != null ? String(m[p]) : '']));
    // return { plan: str(settings.plan_parts ?? {}), cur: str(settings.parts) };   // 계획 인원 주석 처리(2026-10-27)
    return { cur: str(settings.parts), y27: str(settings.parts27 ?? {}) };
  }, [partNames, settings.parts, settings.parts27]);
  const [kind, setKind] = useState<Kind>('cur');   // 지금 보는 연도 — 저장은 두 연도를 같이
  const [draft, setDraft] = useState<Draft>(fromServer);
  useEffect(() => { setDraft(fromServer); }, [fromServer]);   // 서버 값이 바뀌면(저장·다른 관리자) 입력칸을 맞춤

  const val = (k: Kind, p: string) => draft[k][p] ?? '';
  const isChanged = (k: Kind, p: string) => val(k, p) !== fromServer[k][p];
  // const dirty = partNames.some(p => isChanged('plan', p) || isChanged('cur', p));   // 계획 인원 주석 처리(2026-10-27)
  const kindDirty = (k: Kind) => partNames.some(p => isChanged(k, p));
  const dirty = kindDirty('cur') || kindDirty('y27');
  const sum = (k: Kind) => roundHeadcount(partNames.reduce((t, p) => t + toNum(val(k, p)), 0));
  const filled = (k: Kind) => partNames.filter(p => toNum(val(k, p)) > 0).length;

  const setValue = (k: Kind, p: string, v: string) => setDraft(d => ({ ...d, [k]: { ...d[k], [p]: v } }));

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        {!hideTitle && (
          <div className={styles.titleBox}>
            <span className={styles.title}>파트별 인원</span>
            <span className={styles.sub}>2026·2027 인원을 따로 입력합니다 — 각 연도 보기의 인당 매출·손익·관리비의 분모이고, 저장하면 모든 사용자에게 바로 반영돼요</span>
          </div>
        )}
        {settings.updated_at && (
          <span className={styles.meta} title="마지막으로 저장한 시각과 관리자">
            마지막 저장 {settings.updated_at.slice(0, 16)}{settings.updated_by ? ` · ${settings.updated_by}` : ''}
          </span>
        )}
      </div>

      {/* 연도 전환 — 2026 / 2027 인원은 따로 입력(저장은 두 연도를 같이). 저장 안 한 변경이 있는 연도엔 ● */}
      <div className={styles.yearTabs}>
        <div className={styles.yearChips} role="group" aria-label="인원 연도">
          {(['cur', 'y27'] as Kind[]).map(k => (
            <FilterChip key={k} label={`${KIND_INFO[k].chip}${kindDirty(k) ? ' ●' : ''}`} checked={kind === k} onChange={() => setKind(k)} />
          ))}
        </div>
        {/* 2027 인원을 처음 채울 때 편의 — 2026 입력칸 값을 2027 입력칸으로 복사(저장 전까지는 화면에서만, 덮어쓰기 전 확인).
            연도 칩 반대편 오른쪽 끝, 2026 탭에선 자리만 남겨(visibility) 탭을 바꿔도 줄 높이·배치가 안 흔들림(2026-10-29 요청) */}
        <Button variant="ghost" size="sm" className={kind === 'y27' ? undefined : styles.reserved}
          disabled={filled('cur') === 0} tabIndex={kind === 'y27' ? undefined : -1} aria-hidden={kind !== 'y27'}
          title="2026 인원 입력값을 2027 입력칸으로 복사합니다(저장 전까지는 화면에서만)"
          onClick={async () => {
            // 이미 적어 둔 2027 값이 있으면 덮어쓰기 전에 확인 — 브라우저 기본 창이 아니라 사이트 공용 확인창(utils/dialog)
            if (filled('y27') > 0) {
              const ok = await confirmDialog('2027 입력칸에 적은 값이 **2026 인원** 값으로 바뀝니다.\n저장 전까지는 화면에서만 바뀌고, "되돌리기"로 취소할 수 있어요.', {
                title: '2026 인원을 불러올까요?',
                confirmText: '불러오기',
              });
              if (!ok) return;
            }
            setDraft(d => ({ ...d, y27: { ...d.cur } }));
          }}>2026 인원 불러오기</Button>
      </div>

      {isLoading ? <span className={styles.muted}>불러오는 중…</span> : (
        <div className={styles.boxes}>
          <div className={styles.box}>
            <div className={styles.boxHead}>
              <div className={styles.boxTitleBox}>
                <span className={styles.boxTitle}>{KIND_INFO[kind].title}</span>
                <span className={styles.boxDesc}>{KIND_INFO[kind].desc}</span>
              </div>
              <div className={styles.boxTotal}>
                <span className={styles.total}>합계 <b>{formatHeadcount(sum(kind))}</b>명</span>
                <span className={styles.muted}>{filled(kind)}/{partNames.length}개 입력</span>
              </div>
            </div>
            <div className={styles.list}>
              {partNames.map(p => (
                <div key={p} className={`${styles.item} ${isChanged(kind, p) ? styles.itemChanged : ''} ${toNum(val(kind, p)) > 0 ? '' : styles.itemEmpty}`}>
                  <span className={styles.name} title={p}>{p}</span>
                  <Stepper label={KIND_INFO[kind].title} part={p} value={val(kind, p)} onChange={v => setValue(kind, p, v)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={styles.foot}>
        <div className={styles.summary}>
          <span className={styles.muted}>{KIND_INFO[kind].empty}</span>
        </div>
        <div className={styles.footBtns}>
          <Button variant="ghost" size="sm" disabled={!dirty || isSaving} onClick={() => setDraft(fromServer)}>되돌리기</Button>
          <Button variant="primary" size="sm" loading={isSaving} disabled={!dirty}
            // plan_parts를 안 보내면 서버가 저장돼 있던 계획 인원을 그대로 유지함(app.py) — 계획 인원 주석 처리(2026-10-27)
            onClick={() => void save({ parts: draft.cur, parts27: draft.y27 }).catch(() => undefined)}>저장</Button>
        </div>
      </div>
      {error ? <span className={styles.error}>저장 실패: {errText(error)}</span> : null}
    </section>
  );
};

export default PartHeadcountPanel;
