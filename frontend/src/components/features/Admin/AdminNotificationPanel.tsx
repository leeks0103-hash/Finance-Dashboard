import { useEffect, useRef, useState } from 'react';
import { Button, Toggle } from '@/components/ui';
import { useAdminNotificationViewModel } from '@/hooks/viewmodels/useAdminNotificationViewModel';
import {
  DAY_LABELS, DAYS_PRESET_OPTIONS, INTERVAL_OPTIONS, MAX_TIMES, MODE_OPTIONS, PRESET_DAYS,
  daysPreset, scheduleText,
} from '@/utils/notificationSchedule';
import type { DaysPreset } from '@/utils/notificationSchedule';
import sections from './AdminSections.module.css';
import styles from './AdminNotificationPanel.module.css';

interface TimeRow { id: number; v: string }

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
/** 시각 추가 때 먼저 넣어 볼 값 — 이미 있는 시각과 안 겹치는 첫 번째 */
const ADD_CANDIDATES = ['12:00', '13:00', '15:00', '17:00', '10:00', '14:00', '16:00', '09:00', '11:00', '18:00'];

/**
 * 관리자 기능 > 알림 탭(2026-11-05 요청) — 상단 바 종의 [알림 설정]이 여는 곳. **설정만** 있음(2026-11-06 요청 — 예전엔 맨 위에
 * "지금 알림 N건·마지막/다음 확인·[추출 현황 보기]"도 있었는데, 저장된 옛 값이 그대로 보여 틀려 보이고 설정 화면에 현황은 필요 없다고 뺌.
 * 현황은 종 드롭다운·알림 팝업·데이터 탭의 추출 현황에서 봄).
 *  · 확인 일정: 사용 여부(토글) · 요일(선택 상자: 매일/평일/주말/직접 선택) · 방식(선택 상자: 정해진 시각 / 일정 간격)
 *    - 정해진 시각: 하루 최대 6개(시각 입력 + 지우기, [+ 시각 추가])
 *    - 일정 간격: 간격(선택 상자 30분~12시간) + 확인 시간대(시작~끝)
 *    고르는 즉시 서버에 저장(시각 입력은 칸을 벗어나거나 Enter일 때). 처음엔 "매일 오전 8시에 한 번"
 */
const AdminNotificationPanel = () => {
  const vm = useAdminNotificationViewModel();
  const s = vm.settings;

  // 시각 입력칸은 타이핑 중간값을 저장하지 않게 따로 들고 있다가 벗어날 때 저장
  // 줄마다 안 바뀌는 id를 붙여 key로 씀(인덱스·값 key는 타이핑 중 칸이 새로 그려져 포커스를 잃음)
  const nextId = useRef(0);
  const toRows = (times: string[]): TimeRow[] => times.map(v => ({ id: nextId.current++, v }));
  const [timesDraft, setTimesDraft] = useState<TimeRow[]>(() => toRows(s?.times ?? ['08:00']));
  const [startDraft, setStartDraft] = useState(s?.window_start ?? '08:00');
  const [endDraft, setEndDraft] = useState(s?.window_end ?? '18:00');
  // "요일 직접 선택"을 고른 상태 — 저장된 요일이 매일/평일/주말과 같아도 요일 버튼을 계속 보여 주려고 따로 기억
  const [customDays, setCustomDays] = useState(false);
  useEffect(() => { if (s) setTimesDraft(toRows(s.times)); }, [s?.times?.join(',')]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (s) setStartDraft(s.window_start); }, [s?.window_start]);        // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (s) setEndDraft(s.window_end); }, [s?.window_end]);              // eslint-disable-line react-hooks/exhaustive-deps

  if (vm.loadFailed) {
    return <span className={sections.error}>알림 설정을 불러오지 못했습니다. 서버가 켜져 있는지, 알림 기능이 들어간 최신 코드로 재시작했는지(python dashboard_manager.py --start) 확인한 뒤 다시 열어 주세요</span>;
  }
  if (!s) return <span className={sections.hint}>불러오는 중…</span>;

  const preset: DaysPreset = customDays ? 'custom' : daysPreset(s.days);
  const busy = vm.saving;

  const onPreset = (v: DaysPreset) => {
    if (v === 'custom') { setCustomDays(true); return; }
    setCustomDays(false);
    vm.update({ days: PRESET_DAYS[v] });
  };
  const toggleDay = (d: number) => {
    const next = s.days.includes(d) ? s.days.filter(x => x !== d) : [...s.days, d];
    if (next.length === 0) return;               // 요일은 하나 이상 — 마지막 하나는 못 끔
    vm.update({ days: next.sort((a, b) => a - b) });
  };

  /** 시각 입력칸을 벗어날 때 — 형식이 틀리면 저장된 값으로 되돌림 */
  const commitTimes = (draft: TimeRow[]) => {
    const values = draft.map(r => r.v);
    if (values.every(t => TIME_RE.test(t))) {
      const next = [...new Set(values)].sort();
      if (next.join(',') !== s.times.join(',')) vm.update({ times: next });
      else setTimesDraft(toRows(s.times));
    } else setTimesDraft(toRows(s.times));
  };
  const changeTime = (id: number, v: string) => setTimesDraft(d => d.map(r => (r.id === id ? { ...r, v } : r)));
  const removeTime = (i: number) => {
    if (s.times.length <= 1) return;
    vm.update({ times: s.times.filter((_, k) => k !== i) });
  };
  const addTime = () => {
    const free = ADD_CANDIDATES.find(c => !s.times.includes(c));
    if (free && s.times.length < MAX_TIMES) vm.update({ times: [...s.times, free].sort() });
  };

  const commitWindow = () => {
    if (TIME_RE.test(startDraft) && TIME_RE.test(endDraft) && startDraft < endDraft) {
      if (startDraft !== s.window_start || endDraft !== s.window_end) vm.update({ window_start: startDraft, window_end: endDraft });
    } else { setStartDraft(s.window_start); setEndDraft(s.window_end); }   // 시작이 끝보다 늦거나 형식이 틀리면 되돌림
  };

  return (
    <div className={sections.groups}>
      {/* 확인 일정 */}
      <section className={sections.group}>
        <div className={sections.labelRow}>
          <span className={sections.label}>확인 일정</span>
          <span className={sections.lastRun}>{scheduleText(s, vm.slots)}</span>
        </div>

        <div className={styles.toggleRow}>
          <div className={sections.toggleText}>
            <span className={styles.rowLabel}>알림 확인 사용</span>
            <span className={sections.toggleDesc}>끄면 알림 팝업·종의 빨간 점이 안 뜨고 서버도 확인하지 않습니다</span>
          </div>
          <Toggle checked={s.enabled} onChange={() => vm.update({ enabled: !s.enabled })} disabled={busy} />
        </div>

        {s.enabled && (
          <>
            <div className={styles.row}>
              <span className={styles.rowLabel}>요일</span>
              <div className={styles.controls}>
                <select className={styles.select} value={preset} disabled={busy}
                  onChange={e => onPreset(e.target.value as DaysPreset)} aria-label="확인할 요일">
                  {DAYS_PRESET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {preset === 'custom' && (
                  <div className={styles.days} role="group" aria-label="요일 직접 선택">
                    {DAY_LABELS.map((label, d) => (
                      <Button key={label} variant="ghost" size="sm" disabled={busy}
                        className={`${styles.dayBtn} ${s.days.includes(d) ? styles.dayOn : ''}`}
                        aria-pressed={s.days.includes(d)}
                        onClick={() => toggleDay(d)}>{label}</Button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.row}>
              <span className={styles.rowLabel}>방식</span>
              <div className={styles.controls}>
                <select className={styles.select} value={s.mode} disabled={busy}
                  onChange={e => vm.update({ mode: e.target.value as typeof s.mode })} aria-label="확인 방식">
                  {MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {s.mode === 'times' ? (
              <div className={styles.row}>
                <span className={styles.rowLabel}>확인 시각</span>
                <div className={styles.controls}>
                  {timesDraft.map((row, i) => (
                    <div key={row.id} className={styles.timeItem}>
                      <input type="time" className={styles.select} value={row.v} disabled={busy}
                        aria-label={`확인 시각 ${i + 1}`}
                        onChange={e => changeTime(row.id, e.target.value)}
                        onBlur={() => commitTimes(timesDraft)}
                        onKeyDown={e => { if (e.key === 'Enter') commitTimes(timesDraft); }} />
                      {timesDraft.length > 1 && (
                        <Button unstyled className={styles.removeBtn} disabled={busy}
                          onClick={() => removeTime(i)} aria-label={`확인 시각 ${i + 1} 지우기`} title="이 시각 지우기">
                          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                        </Button>
                      )}
                    </div>
                  ))}
                  {s.times.length < MAX_TIMES && (
                    <Button variant="ghost" size="sm" className={styles.addBtn} disabled={busy} onClick={addTime}>+ 시각 추가</Button>
                  )}
                  <span className={sections.hint}>하루 {s.times.length}회 · 최대 {MAX_TIMES}회</span>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>간격</span>
                  <div className={styles.controls}>
                    <select className={styles.select} value={s.interval_minutes} disabled={busy}
                      onChange={e => vm.update({ interval_minutes: Number(e.target.value) })} aria-label="확인 간격">
                      {INTERVAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>확인 시간대</span>
                  <div className={styles.controls}>
                    <div className={styles.timeItem}>
                      <input type="time" className={styles.select} value={startDraft} disabled={busy} aria-label="확인 시간대 시작"
                        onChange={e => setStartDraft(e.target.value)} onBlur={commitWindow}
                        onKeyDown={e => { if (e.key === 'Enter') commitWindow(); }} />
                      <span className={styles.tilde}>~</span>
                      <input type="time" className={styles.select} value={endDraft} disabled={busy} aria-label="확인 시간대 끝"
                        onChange={e => setEndDraft(e.target.value)} onBlur={commitWindow}
                        onKeyDown={e => { if (e.key === 'Enter') commitWindow(); }} />
                    </div>
                    <span className={sections.hint}>
                      하루 {vm.slots.length}회: {vm.slots.join(' · ')}
                    </span>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <span className={sections.hint}>
          {vm.saveError
            ? <span className={sections.error}>{vm.saveError}</span>
            : '서버가 이 일정에 맞춰 추출 현황(아직 안 읽음·열기 실패·원본 수정됨)을 확인합니다. 확인할 파일이 있으면 알림 팝업이 뜨고 종에 빨간 점이 켜지며, 종을 열어 확인하면 꺼집니다(0건이면 아무것도 안 뜸). 서버가 예정 시각에 꺼져 있었다면 켜질 때 한 번 확인합니다.'}
        </span>
      </section>
    </div>
  );
};

export default AdminNotificationPanel;
