import { useCallback, useEffect, useState } from 'react';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { Button, Modal } from '@/components/ui';
import { confirmDialog, toast } from '@/utils/dialog';
import { useTheme } from '@/hooks';
import { useUiStore } from '@/store';
import {
  CHART_SWATCHES, COLOR_ROLES, SWATCH_IDS, colorClashes, colorWarnings, isCustomColor, normalizeHex,
  swatchOf, swatchRgba, valueToHex, type ColorRole, type ChartColorOverrides, type ChartColorValue,
} from '@/utils/chartColors';
import ChartColorPreview from './ChartColorPreview';
import styles from './ChartColorModal.module.css';

const GROUPS = [
  { id: 'bar',   title: '막대 그래프' },
  { id: 'donut', title: '원가 비율 도넛' },
] as const;

/** 저장된 것과 지금 고른 것이 같은지 — 키 순서 무관 */
const sameColors = (a: ChartColorOverrides, b: ChartColorOverrides) => {
  const ka = Object.keys(a) as ColorRole[];
  return ka.length === Object.keys(b).length && ka.every(k => a[k] === b[k]);
};

const labelOf = (role: string) => COLOR_ROLES.find(r => r.role === role)?.label ?? role;

type Issue = { key: string; kind: 'clash' | 'note'; text: string };

/** 모든 역할의 경고를 한 목록으로 — 겹치는 색은 짝(매출·원가 / 원가·매출)을 한 번만 */
const collectIssues = (overrides: Parameters<typeof colorClashes>[1]): Issue[] => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const r of COLOR_ROLES) {
    for (const other of colorClashes(r.role, overrides)) {
      const key = [r.role, other].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, kind: 'clash', text: `${r.label}·${labelOf(other)} 색이 (거의) 같아 구분이 어려워요` });
    }
    for (const w of colorWarnings(swatchOf(r.role, overrides))) {
      out.push({ key: `${r.role}:${w}`, kind: 'note', text: `${r.label}: ${w}` });
    }
  }
  return out;
};

/** 피커를 끄는 동안 매 프레임 반영하면 미리보기가 계속 다시 그려져서 — 잠깐 멈추면 반영 */
const COMMIT_DELAY_MS = 120;

/** 직접 색 고르기 — react-colorful 피커 + hex 입력. 잘못된 hex는 반영 안 하고 안내만 */
const CustomPicker = ({ initial, onPick }: { initial: string; onPick: (hex: `#${string}`) => void }) => {
  const [draft, setDraft] = useState(initial);
  const [typed, setTyped] = useState(initial);

  useEffect(() => {
    const hex = normalizeHex(draft);
    // 열기만 해선 안 바꿈 — 처음 값과 같으면 건너뜀(StrictMode에서 effect가 두 번 돌아 '첫 실행' 표시로는 못 막았음)
    if (!hex || hex === normalizeHex(initial)) return;
    const t = setTimeout(() => onPick(hex), COMMIT_DELAY_MS);
    return () => clearTimeout(t);
  }, [draft, initial, onPick]);

  const invalid = typed.length > 0 && !normalizeHex(typed);

  return (
    <div className={styles.picker}>
      <HexColorPicker color={draft} onChange={c => { setDraft(c); setTyped(c); }} />
      <div className={styles.pickerSide}>
        <label className={styles.hexLabel}>
          <span>색 코드</span>
          {/* 틀린 값으로 칸을 벗어나면 HexColorInput이 마지막 올바른 색으로 되돌림 — 안내도 같이 지움 */}
          <span className={`${styles.hexField} ${invalid ? styles.hexInvalid : ''}`} onBlur={() => setTyped(draft)}>
            #
            <HexColorInput
              color={draft}
              aria-label="색 코드(hex)"
              aria-invalid={invalid}
              // HexColorInput은 올바른 값일 때만 onChange를 부름 — 타이핑 중 틀린 값 안내는 onInput으로
              onInput={e => setTyped(`#${(e.target as HTMLInputElement).value.replace(/^#/, '')}`)}
              onChange={c => { setDraft(c); setTyped(c); }}
            />
          </span>
        </label>
        {invalid && <span className={styles.hexError}>3자리 또는 6자리 16진수(0~9, a~f)로 입력하세요</span>}
        <span className={styles.pickerHint}>야간 모드 색은 이 색에서 자동으로 맞춥니다</span>
      </div>
    </div>
  );
};

/** ⚙ 설정 > 차트 색상 — 역할별로 현대 9색 견본을 고르거나, 피커로 아무 색이나 넣음(2026-10-08).
 *  견본은 지금 테마(주간/야간) 색으로 보여 줌 — 같은 견본이라도 야간엔 밝힌 톤이 쓰임 */
const ChartColorModal = ({ onClose }: { onClose: () => void }) => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const saved = useUiStore(s => s.chartColors);
  const saveChartColors = useUiStore(s => s.saveChartColors);
  // 고르는 동안은 이 모달 안(미리보기·견본)에만 — 저장을 눌러야 3탭 차트에 적용·브라우저에 저장(2026-10-13).
  // 저장 안 하고 닫으면 버려짐
  const [overrides, setOverrides] = useState<ChartColorOverrides>(saved);
  const dirty = !sameColors(overrides, saved);
  const isAllDefault = Object.keys(overrides).length === 0;
  const [pickerRole, setPickerRole] = useState<ColorRole | null>(null);
  const [spin, setSpin] = useState(0);   // 되돌리기 아이콘 회전 — 누를 때마다 한 바퀴
  const setChartColor = useCallback((role: ColorRole, value: ChartColorValue, isDefault: boolean) => {
    setOverrides(prev => {
      const next = { ...prev };
      if (isDefault) delete next[role]; else next[role] = value;
      return next;
    });
  }, []);
  const pickCustom = useCallback((hex: `#${string}`) => {
    if (pickerRole) setChartColor(pickerRole, hex, false);
  }, [pickerRole, setChartColor]);
  // 저장은 한 번 더 묻고, 저장해도 모달은 그대로(이어서 고칠 수 있게) — 2026-10-13 요청
  const save = async () => {
    const ok = await confirmDialog('3개 탭의 모든 차트에 바로 적용됩니다.', {
      title: '차트 색상을 저장하시겠습니까?',
      confirmText: '저장',
    });
    if (!ok) return;
    saveChartColors(overrides);
    toast('차트 색상을 저장했습니다');
  };
  // 경고는 줄 안엔 아이콘만, 문구는 아래 고정 칸에 모음 — 문구가 생기고 사라질 때 줄 높이가 바뀌어 모달이 출렁이던 것(2026-10-13)
  const issues = collectIssues(overrides);
  const firstIssue = issues.find(i => i.kind === 'clash') ?? issues[0];

  return (
    <Modal
      title="차트 색상"
      sub="역할별로 색을 고르고 저장하면 3개 탭의 모든 차트에 적용됩니다 · 이 브라우저에만 저장"
      width={980}
      className={styles.modal}
      closeOnBackdrop={false}
      onClose={onClose}
      footer={
        <div className={styles.footer}>
          <span
            className={`${styles.status} ${firstIssue?.kind === 'clash' ? styles.statusClash : ''}`}
            title={issues.length > 1 ? issues.map(i => `${i.kind === 'clash' ? '⚠' : 'ⓘ'} ${i.text}`).join('\n') : undefined}
            role="status"
          >
            {firstIssue && <>
              {firstIssue.kind === 'clash' ? '⚠' : 'ⓘ'} {firstIssue.text}
              {issues.length > 1 && <b className={styles.statusMore}> 외 {issues.length - 1}건</b>}
            </>}
          </span>
          <div className={styles.actions}>
            <Button
              unstyled
              className={styles.resetBtn}
              disabled={isAllDefault}
              title="기본값으로 되돌리기 (저장해야 적용)"
              aria-label="기본값으로 되돌리기"
              onClick={() => { setOverrides({}); setPickerRole(null); setSpin(n => n + 1); }}
            >
              <svg key={spin} className={spin ? styles.spinOnce : undefined} viewBox="0 0 24 24" width="16" height="16"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 4v5h5" />
              </svg>
            </Button>
            <Button variant="primary" size="sm" disabled={!dirty} onClick={save}>저장</Button>
          </div>
        </div>
      }
    >
      <ChartColorPreview overrides={overrides} />
      {/* 왼쪽 역할 목록 · 오른쪽 직접 고르기 칸(고정) — 피커가 줄 아래로 펼쳐져 목록이 밀리던 것(2026-10-13) */}
      <div className={styles.layout}>
      <div className={styles.list}>
      {GROUPS.map(g => (
        <section key={g.id} className={styles.group}>
          <h4 className={styles.groupTitle}>{g.title}</h4>
          {COLOR_ROLES.filter(r => r.group === g.id).map(r => {
            const current = swatchOf(r.role, overrides);
            const custom = isCustomColor(current);
            const clashes = colorClashes(r.role, overrides);
            const warnings = colorWarnings(current);
            const pickerOpen = pickerRole === r.role;
            return (
              <div key={r.role} className={styles.rowWrap}>
                <div className={styles.row}>
                  <div className={styles.roleText}>
                    <span className={styles.roleLabel}>
                      {r.label}
                      {/* 경고는 아이콘만(줄 높이 그대로) — 문구는 마우스 올리면, 그리고 아래 고정 칸에 */}
                      {clashes.length > 0 && (
                        <span className={styles.flagClash} title={`${clashes.map(labelOf).join('·')}와 색이 (거의) 같아 구분이 어려워요`}>⚠</span>
                      )}
                      {warnings.length > 0 && (
                        <span className={styles.flagNote} title={warnings.join('\n')}>ⓘ</span>
                      )}
                    </span>
                    <span className={styles.roleDesc}>{r.desc}</span>
                  </div>
                  <div className={styles.swatches} role="radiogroup" aria-label={`${r.label} 색`}>
                    {SWATCH_IDS.map(id => (
                      <Button
                        key={id}
                        unstyled
                        role="radio"
                        aria-checked={current === id}
                        title={`${CHART_SWATCHES[id].name}${id === r.default ? ' (기본)' : ''}`}
                        className={`${styles.swatch} ${current === id ? styles.selected : ''}`}
                        style={{ background: swatchRgba(id, dark) }}
                        onClick={() => { setChartColor(r.role, id, id === r.default); setPickerRole(null); }}
                      >
                        {id === r.default && <span className={styles.defaultDot} aria-hidden />}
                      </Button>
                    ))}
                    {/* 직접 고르기 — 직접 넣은 색이면 그 색으로, 아니면 무지개 원 */}
                    <Button
                      unstyled
                      role="radio"
                      aria-checked={custom}
                      aria-expanded={pickerOpen}
                      title={custom ? `직접 고른 색 ${current}` : '직접 고르기'}
                      className={`${styles.swatch} ${styles.customSwatch} ${custom ? styles.selected : ''}`}
                      style={custom ? { background: swatchRgba(current, dark) } : undefined}
                      onClick={() => setPickerRole(pickerOpen ? null : r.role)}
                    >
                      <span className={styles.plus} aria-hidden>+</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      ))}
      </div>
      <aside className={styles.side} aria-live="polite">
        {pickerRole ? (
          <>
            <div className={styles.sideHead}>
              <span className={styles.sideTitle}>{labelOf(pickerRole)} · 직접 고르기</span>
              <Button variant="ghost" size="sm" onClick={() => setPickerRole(null)}>닫기</Button>
            </div>
            <CustomPicker key={pickerRole} initial={valueToHex(swatchOf(pickerRole, overrides))} onPick={pickCustom} />
          </>
        ) : (
          <p className={styles.sideEmpty}>견본 줄 끝의 <span className={styles.sideRainbow} aria-hidden /> 를 누르면<br />여기서 아무 색이나 고를 수 있어요</p>
        )}
      </aside>
      </div>
    </Modal>
  );
};

export default ChartColorModal;
