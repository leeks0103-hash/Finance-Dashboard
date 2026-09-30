import { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { usePresence } from '@/components/ui/useAnimatedClose';
import styles from './InfoButton.module.css';

interface Props {
  children: ReactNode;
}

const POPOVER_W = 360;
const GAP = 8;        // 버튼과 팝오버 사이
const EDGE = 12;      // 화면 가장자리 여백

/**
 * 제목 옆 ⓘ — 클릭하면 데이터 기준 설명 팝오버.
 * 팝오버는 document.body에 포털로 그린다 — 예전엔 버튼 옆(제목 요소 안)에 그려서 차트 제목·표 제목·
 * 섹션 제목마다 다른 굵기·자간·정렬을 그대로 물려받아 정보창마다 모양이 제각각이었음(2026-09-30).
 * 위치는 버튼 기준 fixed로 계산(아래쪽, 왼쪽 정렬, 화면 밖으로 안 나가게).
 */
export const InfoButton = ({ children }: Props) => {
  const [open, setOpen] = useState(false);
  const pop = usePresence(open);   // 닫힐 때도 퇴장 애니메이션(.closingDrop)
  // 버튼을 감싼 span — Button이 ref를 안 받아서 이걸로 위치를 잼(크기는 버튼과 같음)
  const btnRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // 버튼 위치 기준 좌표 — 오른쪽이 넘치면 왼쪽으로 당기고, 아래가 모자라면 버튼 위로
  const place = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const popH = popRef.current?.offsetHeight ?? 0;
    const left = Math.min(Math.max(EDGE, r.left), window.innerWidth - POPOVER_W - EDGE);
    const below = r.bottom + GAP;
    const top = popH && below + popH > window.innerHeight - EDGE && r.top - GAP - popH > EDGE
      ? r.top - GAP - popH
      : below;
    setPos({ top, left });
  };

  // 열릴 때 한 번 + 팝오버 높이를 안 뒤 한 번 더(위로 뒤집을지 판단)
  useLayoutEffect(() => {
    if (!pop.mounted) { setPos(null); return; }
    place();
    const raf = requestAnimationFrame(place);
    return () => cancelAnimationFrame(raf);
  }, [pop.mounted]);

  // 스크롤·리사이즈 시 따라감(표·모달 안 스크롤 포함 — capture)
  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  // 바깥 클릭 닫기 — 팝오버가 버튼 밖(body)에 있으니 둘 다 확인
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={btnRef} className={styles.wrap}>
      <Button
        unstyled
        className={styles.btn}
        onClick={() => setOpen(v => !v)}
        aria-label="데이터 기준 설명"
        aria-expanded={open}
        type="button"
      >
        i
      </Button>
      {pop.mounted && createPortal(
        <div
          ref={popRef}
          role="dialog"
          className={`${styles.popover} ${pop.closing ? 'closingDrop' : ''}`}
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: POPOVER_W }}
        >
          <div className={styles.content}>{children}</div>
        </div>,
        document.body,
      )}
    </span>
  );
};

export default InfoButton;
