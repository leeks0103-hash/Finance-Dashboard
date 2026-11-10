import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { usePresence } from '@/components/ui/useAnimatedClose';
import { useEscToClose } from '@/components/ui/useEscToClose';
import { useNewAlertPopup } from '@/hooks/useNewAlertPopup';
import { useNotificationViewModel } from '@/hooks/viewmodels/useNotificationViewModel';
import styles from './Navbar.module.css';

interface Props {
  /** "추출 현황 열기" — 관리자 기능 창의 '데이터' 탭(PPT 추출 > 추출 현황)을 엶. 알림 팝업의 [추출 현황 열기]도 같은 곳 */
  onOpenData: () => void;
  /** "알림 설정" — 관리자 기능 창의 '알림' 탭(확인 시각·빈도 설정)을 엶 */
  onOpenSettings: () => void;
}

/** 알림 종 아이콘 — 글자색(currentColor)을 따름 */
const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2.6a1.3 1.3 0 0 1 1.3 1.3v.5c2.8.6 4.7 3 4.7 5.9v3.3l1.7 2.6c.4.6 0 1.4-.8 1.4H5.1c-.8 0-1.2-.8-.8-1.4L6 13.6v-3.3c0-2.9 1.9-5.3 4.7-5.9v-.5A1.3 1.3 0 0 1 12 2.6Z" />
    <path d="M9.6 19.2h4.8a2.4 2.4 0 0 1-4.8 0Z" />
  </svg>
);

/** 봉투 — 드롭다운 머리글(메일함 느낌) */
const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="5.5" width="18" height="13" rx="2" />
    <path d="m3.6 7.6 8.4 6.2 8.4-6.2" />
  </svg>
);

/**
 * 관리자 알림 종 — 메일함처럼 동작(2026-11-06 요청, 처음엔 합계 숫자 배지였음).
 *  · 추출 현황의 '아직 안 읽음·열기 실패·원본 수정됨'이 **0건이면** 종만 있고 아무 표시·팝업도 없음
 *  · 새로 확인할 게 생기면(서버가 정한 시각에 셈) 종 오른쪽 위에 **빨간 점**(숫자 없음) + 봉투 아이콘 팝업(useNewAlertPopup)
 *  · 종을 열어 목록을 보면(또는 팝업에서 [추출 현황 열기]) 확인한 것으로 보고 **점이 꺼짐** — 건수가 더 늘 때만 다시 켜짐
 * 서버가 관리자가 정한 시각·빈도(기본 매일 아침 8시)에 세어 저장한 값. 확인을 끄면 점도 팝업도 없음
 */
const NotificationBell = ({ onOpenData, onOpenSettings }: Props) => {
  const vm = useNotificationViewModel();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const drop = usePresence(open);

  useNewAlertPopup(vm, onOpenData);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  useEscToClose(() => setOpen(false), open);

  const hasAlert = vm.total > 0;
  const toggle = () => {
    // 열면서 확인 처리 — 목록을 본 것이므로 빨간 점을 끔(이미 열려 있다 닫는 건 그대로)
    if (!open) vm.markSeen();
    setOpen(v => !v);
  };

  return (
    <div className={styles.settings} ref={ref} data-tour="notifications">
      <Button unstyled
        className={`${styles.settingsBtn} ${styles.bellBtn}`}
        onClick={toggle}
        aria-label={vm.unread ? '새 알림이 있습니다' : '알림'}
        aria-expanded={open}
        title={vm.unread ? `확인이 필요한 파일 ${vm.total}건 — 눌러서 확인` : hasAlert ? '알림 (확인함)' : '알림 없음'}
      >
        <BellIcon />
        {vm.unread && <span className={styles.bellDot} aria-hidden />}
      </Button>

      {drop.mounted && (
        <div className={`${styles.bellDropdown} ${drop.closing ? 'closingDrop' : ''}`}>
          <div className={styles.bellHeader}><MailIcon /> 알림</div>
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
          {/* [추출 현황 열기]는 확인이 필요한 파일이 있을 때만(2026-11-05 요청 "필요한 파일도 없는데 열기 버튼은 왜"),
              [알림 설정]은 항상 — 확인 시각·빈도는 관리자 기능 > 알림 탭에서만 바꿈(그 탭엔 현황이 없고 설정만) */}
          <div className={styles.bellFoot}>
            <Button variant="ghost" size="sm" onClick={() => { setOpen(false); onOpenSettings(); }}>
              알림 설정
            </Button>
            {hasAlert && (
              <Button variant="primary" size="sm" className={styles.bellPrimary} onClick={() => { setOpen(false); onOpenData(); }}>
                추출 현황 열기
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
