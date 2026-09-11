import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, FilterSelect } from '@/components/ui';
import styles from './CostFilterPopover.module.css';

interface Props {
  teams:        string[];
  selectedTeam: string;
  onTeamChange: (v: string) => void;
  /** 이미 팀에 맞춰 좁혀진 목록 — 첫 항목이 '전체' */
  parts:        string[];
  selectedPart: string;
  onPartChange: (v: string) => void;
}

/**
 * 원가 비율 카드 제목줄의 ⚙ 버튼 — 눌러야 팀/파트 셀렉트 2개가 뜨는 설정 패널.
 * 제목줄엔 칸이 부족하고 그래프도 줄이고 싶지 않아서, 평소엔 숨겨뒀다 클릭할 때만 노출.
 */
const CostFilterPopover = ({ teams, selectedTeam, onTeamChange, parts, selectedPart, onPartChange }: Props) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const active = selectedTeam !== '' || selectedPart !== '전체';

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <Button
        unstyled
        className={`${styles.trigger} ${active ? styles.active : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label="원가 비율 팀/파트 필터"
        title="팀/파트 선택"
      >
        ⚙
      </Button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>팀</span>
            <FilterSelect
              value={selectedTeam}
              // 팀을 바꾸면 파트도 '전체'로 — 이전 팀의 파트가 새 팀엔 없을 수 있어서
              onChange={v => { onTeamChange(v); onPartChange('전체'); }}
              options={teams}
              allLabel="전체"
            />
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>파트</span>
            <FilterSelect
              value={selectedPart}
              onChange={onPartChange}
              options={parts}
              allLabel={null}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CostFilterPopover;
