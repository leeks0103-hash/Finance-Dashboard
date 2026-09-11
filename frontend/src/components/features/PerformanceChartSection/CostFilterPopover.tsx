import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui';
import { stripPartPrefix } from '@/utils';
import styles from './CostFilterPopover.module.css';

interface Props {
  teams:        string[];
  selectedTeam: string;
  onTeamChange: (v: string) => void;
  /** 팀 → 소속 파트(원문, 접두어 포함) — 패널 안에서 팀을 펼치면 그 파트들이 하위 목록으로 나온다 */
  teamParts:    Record<string, string[]>;
  /** 접두어 제거된 값. '전체'가 기본 */
  selectedPart: string;
  onPartChange: (v: string) => void;
}

/**
 * 원가 비율 카드 제목줄의 ⚙ 버튼 — 눌러야 뜨는 설정 패널.
 * 팀을 눌러 펼치면 그 안에 소속 파트가 하위 목록(드롭다운 안의 드롭다운)으로 나오고,
 * 파트를 고르면 팀·파트가 한 번에 정해지며 패널이 닫힌다.
 */
const CostFilterPopover = ({ teams, selectedTeam, onTeamChange, teamParts, selectedPart, onPartChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string>(selectedTeam);
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

  const pickAll = () => { onTeamChange(''); onPartChange('전체'); close(); };
  const pickPart = (team: string, rawPart: string) => {
    onTeamChange(team);
    onPartChange(stripPartPrefix(rawPart));
    close();
  };

  return (
    <div className={`${styles.wrap} chart-title-filter`} ref={wrapRef}>
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
          <Button
            unstyled
            className={`${styles.allItem} ${!active ? styles.itemActive : ''}`}
            onClick={pickAll}
          >
            전체
          </Button>

          <ul className={styles.teamList}>
            {teams.map(team => {
              const isExpanded = expandedTeam === team;
              const parts = teamParts[team] ?? [];
              return (
                <li key={team}>
                  <Button
                    unstyled
                    className={`${styles.teamItem} ${selectedTeam === team ? styles.itemActive : ''}`}
                    onClick={() => setExpandedTeam(isExpanded ? '' : team)}
                    aria-expanded={isExpanded}
                  >
                    <span className={styles.caret}>{isExpanded ? '▾' : '▸'}</span>
                    {team}
                  </Button>

                  {/* 드롭다운 안의 드롭다운 — 팀을 펼치면 그 소속 파트만 하위 목록으로 */}
                  {isExpanded && parts.length > 0 && (
                    <ul className={styles.partList}>
                      {parts.map(p => (
                        <li key={p}>
                          <Button
                            unstyled
                            className={`${styles.partItem} ${selectedTeam === team && selectedPart === stripPartPrefix(p) ? styles.itemActive : ''}`}
                            onClick={() => pickPart(team, p)}
                          >
                            {stripPartPrefix(p)}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CostFilterPopover;
