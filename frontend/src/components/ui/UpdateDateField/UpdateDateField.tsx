import { useEffect, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { ko } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { usePresence } from '@/components/ui/useAnimatedClose';
import { Button } from '../Button';
import styles from './UpdateDateField.module.css';

interface Props {
  label: string;
  /** 라벨 글자도 직접 고칠 때 — 없으면 라벨은 고정 */
  onLabelChange?: (v: string) => void;
  /** false면 라벨·값 모두 읽기 전용 글자로(달력 버튼도 없음) — 관리자만 고치게 할 때 */
  editable?: boolean;
  /** 자유 입력 글자 — 날짜가 아니어도 됨(예: "10월 2주차 반영") */
  value: string;
  /** 확정됐을 때만 호출(Enter·칸 벗어남·달력 선택) — 글자 칠 때마다 저장하지 않게 */
  onChange: (v: string) => void;
  placeholder?: string;
}

const LABEL_PLACEHOLDER = '항목 이름';

// Date → 'YYYY-MM-DD' (로컬 기준 — toISOString은 UTC라 하루 밀릴 수 있음)
const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// 입력칸 글자가 날짜 모양(2026-10-13 · 2026.10.13 · 2026/10/13)이면 달력에 그 날을 선택해서 띄움
const parseYmd = (s: string): Date | undefined => {
  const m = s.trim().match(/^(\d{4})[-./]\s?(\d{1,2})[-./]\s?(\d{1,2})/);
  if (!m) return undefined;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return isNaN(d.getTime()) ? undefined : d;
};

/** 입력 중 글자는 따로 들고 있다가 Enter·칸 벗어날 때 확정. ESC는 원래 값으로. 바깥 값이 바뀌면(다른 화면 저장) 따라감 */
const useDraft = (value: string, commit: (v: string) => void) => {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  useEffect(() => { if (!editing.current) setDraft(value); }, [value]);
  const done = () => {
    editing.current = false;
    if (draft.trim() !== value) commit(draft.trim());
  };
  return {
    value: draft,
    onFocus: () => { editing.current = true; },
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
    onBlur: done,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') e.currentTarget.blur();
      if (e.key === 'Escape') { setDraft(value); editing.current = false; e.currentTarget.blur(); }
    },
  };
};

/**
 * 라벨 + 직접 입력칸 + 달력 버튼(react-day-picker). 달력에서 고르면 YYYY-MM-DD로 들어가고,
 * 입력칸은 아무 글자나 직접 고쳐 쓸 수 있음. onLabelChange를 주면 라벨도 입력칸, editable=false면 전부 글자로만
 */
export const UpdateDateField = ({
  label, onLabelChange, editable = true, value, onChange, placeholder = 'YYYY-MM-DD',
}: Props) => {
  const [open, setOpen] = useState(false);
  const pop = usePresence(open);
  const ref = useRef<HTMLDivElement>(null);
  const noteDraft  = useDraft(value, onChange);
  const labelDraft = useDraft(label, v => onLabelChange?.(v));
  const selected = parseYmd(value);

  // 바깥 클릭 / ESC로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!editable) {
    return (
      <div className={styles.wrap}>
        <span className={styles.label}>{label} :</span>
        <span className={styles.readValue}>{value || '-'}</span>
      </div>
    );
  }

  return (
    <div className={styles.wrap} ref={ref}>
      {onLabelChange ? (
        <span className={styles.labelEdit}>
          {/* 글자 폭만큼만 — field-sizing 미지원 브라우저는 size(글자 수)로 */}
          <input
            className={`${styles.input} ${styles.labelInput}`}
            size={Math.max(labelDraft.value.length, 4) + 2}
            placeholder={LABEL_PLACEHOLDER}
            aria-label={LABEL_PLACEHOLDER}
            title="항목 이름 고치기 — Enter로 저장"
            {...labelDraft}
          />
          <span className={styles.label}>:</span>
        </span>
      ) : (
        <span className={styles.label}>{label} :</span>
      )}
      <input
        className={styles.input}
        placeholder={placeholder}
        aria-label={label || LABEL_PLACEHOLDER}
        title="직접 입력 — Enter로 저장"
        {...noteDraft}
      />
      <Button unstyled className={styles.calBtn} onClick={() => setOpen(o => !o)}
        title="달력에서 고르기" aria-expanded={open}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <rect x="2" y="3" width="12" height="11" rx="1.5" />
          <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
        </svg>
      </Button>

      {pop.mounted && (
        <div className={`${styles.pop} ${pop.closing ? 'closingDrop' : ''}`}>
          {/* 날짜 버튼은 라이브러리가 만드는 <button> — driver.js처럼 <Button> 규칙 예외 */}
          <DayPicker
            mode="single"
            locale={ko}
            selected={selected}
            defaultMonth={selected ?? new Date()}
            onSelect={d => { if (d) { onChange(toYmd(d)); setOpen(false); } }}
          />
        </div>
      )}
    </div>
  );
};
