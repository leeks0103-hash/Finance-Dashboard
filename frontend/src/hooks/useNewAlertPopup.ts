import { useEffect, useRef } from 'react';
import { confirmDialog, isDialogOpen } from '@/utils/dialog';
import type { NotificationViewModel } from './viewmodels/useNotificationViewModel';

type PopupSource = Pick<NotificationViewModel, 'unread' | 'total' | 'summaryLines' | 'markSeen'>;

/** 다른 확인·알림 창이 열려 있을 때 다시 시도하는 간격·횟수(총 1분) — 새 창을 띄우면 열린 창이 "취소"로 처리되므로 기다림 */
const RETRY_MS = 3000;
const MAX_RETRIES = 20;

/**
 * 새 알림 팝업(2026-11-06 요청) — 서버가 정해진 시각(기본 08:00)에 센 결과에 확인할 게 있으면, 메일이 도착한 것처럼
 * 봉투 아이콘의 확인창을 한 번 띄움(종의 빨간 점과 같이). 0건이면 아무것도 안 띄움.
 *  · [추출 현황 열기] → 확인한 것으로 기록(점 꺼짐) + 추출 현황으로
 *  · [나중에]·바깥 클릭·ESC → 점은 그대로(종을 열어 확인할 때 꺼짐)
 * 같은 알림으로는 이 화면(탭)에서 한 번만 — 5분마다 다시 받아도 반복해서 안 뜸. 건수가 달라지면(새로 생김) 다시 뜸.
 * 페이지를 새로 열면 아직 확인 안 한 알림은 다시 한 번 알려 줌(확인할 때까지 메일이 안 읽힌 상태)
 */
export const useNewAlertPopup = (vm: PopupSource, onOpen: () => void): void => {
  const shownFor = useRef<string | null>(null);
  // 최신 함수를 ref로 — 이 둘이 바뀔 때마다 팝업 효과가 다시 돌면 안 됨
  const latest = useRef({ onOpen, markSeen: vm.markSeen, total: vm.total, lines: vm.summaryLines });
  latest.current = { onOpen, markSeen: vm.markSeen, total: vm.total, lines: vm.summaryLines };

  const signature = vm.summaryLines.join('|');

  useEffect(() => {
    if (!vm.unread || shownFor.current === signature) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tryShow = async (attempt: number): Promise<void> => {
      if (cancelled) return;
      if (isDialogOpen()) {
        if (attempt < MAX_RETRIES) timer = setTimeout(() => { void tryShow(attempt + 1); }, RETRY_MS);
        return;
      }
      shownFor.current = signature;
      const { total, lines } = latest.current;
      const open = await confirmDialog(
        `**확인이 필요한 파일 ${total}건**\n\n${lines.join('\n')}`,
        { title: '새 알림이 도착했습니다', icon: 'mail', confirmText: '추출 현황 열기', cancelText: '나중에' },
      );
      if (open) { latest.current.markSeen(); latest.current.onOpen(); }
    };
    void tryShow(0);

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [vm.unread, signature]);
};
