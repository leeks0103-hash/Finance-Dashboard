import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { usePresence } from '@/components/ui/useAnimatedClose';
import { useEscToClose } from '@/components/ui/useEscToClose';
import { useNotificationViewModel } from '@/hooks/viewmodels/useNotificationViewModel';
import styles from './Navbar.module.css';

interface Props {
  /** "알림 설정·현황 열기" — 관리자 기능 창의 '알림' 탭을 엶(확인 시각·빈도 설정, 추출 현황으로 가는 길)(2026-11-05 요청) */
  onOpenAlerts: () => void;
}

/** 알림 종 아이콘 — 글자색(currentColor)을 따름 */
const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2.6a1.3 1.3 0 0 1 1.3 1.3v.5c2.8.6 4.7 3 4.7 5.9v3.3l1.7 2.6c.4.6 0 1.4-.8 1.4H5.1c-.8 0-1.2-.8-.8-1.4L6 13.6v-3.3c0-2.9 1.9-5.3 4.7-5.9v-.5A1.3 1.3 0 0 1 12 2.6Z" />
    <path d="M9.6 19.2h4.8a2.4 2.4 0 0 1-4.8 0Z" />
  </svg>
);

/**
 * 관리자 알림 종(2026-11-05) — 사람 아이콘과 ⚙ 사이. 추출 현황의 '아직 안 읽음·열기 실패·원본 수정됨'이 하나라도 있으면
 * 종 오른쪽 아래에 빨간 동그라미 + 합계. 서버가 관리자가 정한 시각·빈도(기본 매일 아침 8시)에 세어 저장한 값. 0이거나 확인을 끄면 종만 보이고 배지 없음
 */
const NotificationBell = ({ onOpenAlerts }: Props) => {
  const vm = useNotificationViewModel();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const drop = usePresence(open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  useEscToClose(() => setOpen(false), open);

  const hasAlert = vm.total > 0;
  return (
    <div className={styles.settings} ref={ref} data-tour="notifications">
      <Button unstyled
        className={`${styles.settingsBtn} ${styles.bellBtn}`}
        onClick={() => setOpen(v => !v)}
        aria-label={hasAlert ? `알림 ${vm.total}건` : '알림 없음'}
        aria-expanded={open}
        title={hasAlert ? `추출 현황 확인이 필요한 파일 ${vm.total}건` : '추출 현황 알림 없음'}
      >
        <BellIcon />
        {hasAlert && <span className={styles.bellBadge} aria-hidden>{vm.badgeText}</span>}
      </Button>

      {drop.mounted && (
        <div className={`${styles.bellDropdown} ${drop.closing ? 'closingDrop' : ''}`}>
          <div className={styles.bellHeader}>알림</div>
          {!vm.enabled ? (
            <p className={styles.bellEmpty}>알림 확인이 꺼져 있습니다</p>
          ) : hasAlert ? (
            <ul className={styles.bellList}>
              {vm.groups.map(g => (
                <li key={g.key} className={styles.bellItem}>
                  <span className={styles.bellSource}>{g.label}</span>
                  <span className={styles.bellCounts}>
                    {g.items.map(i => (
                      <span key={i.label}>{i.label} <b>{i.count}</b></span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.bellEmpty}>확인이 필요한 파일이 없습니다</p>
          )}
          <p className={styles.bellMeta}>
            {vm.checkedAt ? `마지막 확인 ${vm.checkedAt}` : '아직 확인 전'} · {vm.scheduleText}
            {vm.checkFailed && <span className={styles.bellWarn}> · 마지막 시도는 원본 폴더 접근 실패(위 숫자는 이전 확인 결과)</span>}
          </p>
          {/* 확인이 필요한 파일이 있을 때만 버튼(2026-11-05 요청 "필요한 파일도 없는데 열기 버튼은 왜") — 없거나 꺼져 있으면 안내 문구만.
              설정은 관리자 기능 > 알림 탭에서 그대로 바꿀 수 있음 */}
          {hasAlert && (
            <div className={styles.bellFoot}>
              <Button variant="primary" size="sm" onClick={() => { setOpen(false); onOpenAlerts(); }}>
                알림 설정·현황 열기
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
