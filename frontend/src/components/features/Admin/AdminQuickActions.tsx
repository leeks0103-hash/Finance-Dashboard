import { useState } from 'react';
import { Button } from '@/components/ui';
import { useUiStore } from '@/store';
import PartHeadcountModal from './PartHeadcountModal';
import type { HeadcountKind } from './PartHeadcountPanel';
import styles from './AdminQuickActions.module.css';

/** 파트별 인원 입력 아이콘(사람 여럿) — 글자색(currentColor)을 따름 */
const GroupIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="9" cy="8.5" r="3.4" />
    <path d="M2.5 19.5c0-3.5 2.9-5.9 6.5-5.9s6.5 2.4 6.5 5.9a.9.9 0 0 1-.9.9H3.4a.9.9 0 0 1-.9-.9Z" />
    <circle cx="17" cy="9.5" r="2.7" opacity=".7" />
    <path d="M16.6 13.9c2.9.1 5 2 5 4.9a.8.8 0 0 1-.8.8h-3.6c.2-1.9-.3-3.7-1.6-4.9.3-.5.7-.7 1-.8Z" opacity=".7" />
  </svg>
);

interface Props {
  /** 인원 입력 창을 처음 열 때 보여 줄 연도 — 2027 계획 보기 카드에선 'y27' */
  headcountKind?: HeadcountKind;
}

/**
 * 실적 탭 "파트별 인원" 카드 오른쪽 끝의 [인원 입력] 버튼(2026-10-29 — 예전엔 상단 바 아이콘).
 * 파트별 인원 창(PartHeadcountModal)을 연다. 인원은 관리자만 고칠 수 있음(서버도 관리자 API라 403).
 * 관리자가 아니면 아무것도 안 그림 — 일반 회원·미로그인에겐 존재 자체가 안 보임.
 * (관리자 기능 창을 여는 버튼은 상단 바에 그대로 있음)
 */
const AdminQuickActions = ({ headcountKind = 'cur' }: Props) => {
  const isAdmin = useUiStore(s => s.adminAuthed);
  const [open, setOpen] = useState(false);
  if (!isAdmin) return null;

  return (
    <>
      <div className={styles.wrap}>
        <Button variant="ghost" size="sm" className={styles.btn} icon={<GroupIcon />}
          onClick={() => setOpen(true)}
          title="파트별 인원 입력 (인당 차트의 분모 — 관리자만)">
          인원 입력
        </Button>
      </div>
      {open && <PartHeadcountModal initialKind={headcountKind} onClose={() => setOpen(false)} />}
    </>
  );
};

export default AdminQuickActions;
