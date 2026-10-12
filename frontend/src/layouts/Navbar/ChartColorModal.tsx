import { useEffect, useRef, useState } from 'react';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { Button, Modal } from '@/components/ui';
import { useTheme } from '@/hooks';
import { useUiStore } from '@/store';
import {
  CHART_SWATCHES, COLOR_ROLES, SWATCH_IDS, colorClashes, colorWarnings, isCustomColor, normalizeHex,
  swatchOf, swatchRgba, valueToHex, type ColorRole,
} from '@/utils/chartColors';
import ChartColorPreview from './ChartColorPreview';
import styles from './ChartColorModal.module.css';

const GROUPS = [
  { id: 'bar',   title: '막대 그래프' },
  { id: 'donut', title: '원가 비율 도넛' },
] as const;

const labelOf = (role: string) => COLOR_ROLES.find(r => r.role === role)?.label ?? role;

/** 피커를 끄는 동안 매 프레임 저장하면 3탭 차트가 계속 다시 그려지고 localStorage도 계속 써서 — 잠깐 멈추면 반영 */
const COMMIT_DELAY_MS = 120;

/** 직접 색 고르기 — react-colorful 피커 + hex 입력. 잘못된 hex는 반영 안 하고 안내만 */
const CustomPicker = ({ role, initial }: { role: ColorRole; initial: string }) => {
  const setChartColor = useUiStore(s => s.setChartColor);
  const [draft, setDraft] = useState(initial);
  const [typed, setTyped] = useState(initial);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; } // 열기만 해선 저장 안 함
    const t = setTimeout(() => {
      const hex = normalizeHex(draft);
      if (hex) setChartColor(role, hex, false);
    }, COMMIT_DELAY_MS);
    return () => clearTimeout(t);
  }, [draft, role, setChartColor]);

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
  const overrides = useUiStore(s => s.chartColors);
  const setChartColor = useUiStore(s => s.setChartColor);
  const reset = useUiStore(s => s.resetChartColors);
  const changed = Object.keys(overrides).length > 0;
  const [pickerRole, setPickerRole] = useState<ColorRole | null>(null);

  return (
    <Modal
      title="차트 색상"
      sub="역할별로 색을 고르면 3개 탭의 모든 차트에 바로 적용됩니다 · 이 브라우저에만 저장"
      width={600}
      className={styles.modal}
      onClose={onClose}
      footer={
        <div className={styles.footer}>
          <Button variant="ghost" size="sm" disabled={!changed} onClick={() => { reset(); setPickerRole(null); }}>
            기본값으로 되돌리기
          </Button>
        </div>
      }
    >
      <ChartColorPreview />
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
                    <span className={styles.roleLabel}>{r.label}</span>
                    <span className={styles.roleDesc}>{r.desc}</span>
                    {clashes.length > 0 && (
                      <span className={styles.clash}>⚠ {clashes.map(labelOf).join('·')}와 색이 (거의) 같아 구분이 어려워요</span>
                    )}
                    {warnings.map(w => <span key={w} className={styles.note}>ⓘ {w}</span>)}
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
                {pickerOpen && <CustomPicker role={r.role} initial={valueToHex(current)} />}
              </div>
            );
          })}
        </section>
      ))}
    </Modal>
  );
};

export default ChartColorModal;
