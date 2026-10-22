import { useRef, useEffect, type ReactNode } from 'react';
import { Button, CopyText } from '@/components/ui';
import { prefersReducedMotion } from '@/utils';
import styles from './FinanceCrossCheckPanel.module.css';

interface Props {
  title:    string;
  code:     string;
  onClose:  () => void;
  children: ReactNode;
}

/**
 * 2뎁스(펼침) 재무 패널 뼈대 — 헤더(제목·프로젝트코드·×) + 부모 가로 스크롤을 따라다니는 고정 폭.
 * 프로젝트 상세의 "재무 이력"과 미수주 프로젝트의 "재무 데이터 상세"가 같은 모양이 되게 공용화(2026-10-22 요청 — 미수주 쪽만 key-value 카드라 달랐음)
 */
const FinancePanelShell = ({ title, code, onClose, children }: Props) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // 가로 스크롤 translateX 동기화 — 부모(실적 테이블)가 가로 스크롤돼도 패널은 화면에 고정
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    let el: HTMLElement | null = panel.parentElement;
    while (el) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') break;
      el = el.parentElement;
    }
    if (!el) return;
    // 스크롤 위치를 바로 따라가지 않고 매 프레임 남은 거리의 18%씩 쫓아감 — 표가 먼저 움직이고 패널이
    // 살짝 끌려오다 제자리에 붙는 느낌(2026-09-29, "고정된 느낌 말고" 요청). 움직임 줄이기 설정이면 즉시
    const reduce = prefersReducedMotion();
    let current = el.scrollLeft;
    let raf = 0;
    const apply = () => { panel.style.transform = `translateX(${current}px)`; };
    const step = () => {
      const target = el!.scrollLeft;
      current += (target - current) * 0.18;
      if (Math.abs(target - current) < 0.5) { current = target; raf = 0; apply(); return; }
      apply();
      raf = requestAnimationFrame(step);
    };
    const sync = () => {
      if (reduce) { current = el!.scrollLeft; apply(); return; }
      if (!raf) raf = requestAnimationFrame(step);
    };
    apply();
    el.addEventListener('scroll', sync, { passive: true });
    // 패널 폭 = 스크롤 컨테이너의 "보이는" 폭 — 고정 1600px이면 넓은 화면에선 남고 좁은 화면에선
    // 잘렸음(2026-09-28). 펼침 td 좌측 막대는 inset 그림자라 폭을 먹지 않음
    const fit = () => { panel.style.width = `${el!.clientWidth}px`; };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => { el!.removeEventListener('scroll', sync); ro.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div ref={panelRef} className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>{title}</span>
          {/* 프로젝트코드 클릭 → 클립보드 복사 (1depth 테이블과 동일 동작) */}
          <CopyText text={code} className={styles.code} />
        </div>
        <div className={styles.headerRight}>
          <Button unstyled className={styles.closeBtn} onClick={onClose} aria-label="닫기">×</Button>
        </div>
      </div>
      {children}
    </div>
  );
};

export default FinancePanelShell;
