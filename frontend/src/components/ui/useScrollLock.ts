import { useEffect } from 'react';

/**
 * 모달이 열린 동안 body 스크롤 잠금 + 스크롤바 폭만큼 padding-right 보정.
 * 보정을 안 하면 세로 스크롤바가 사라지면서 페이지 콘텐츠가 그 폭(≈15px)만큼 넓어져
 * 화면이 옆으로 튀는 것처럼 보인다.
 *
 * @param active true인 동안 잠금 (보통 모달 open 상태)
 */
export const useScrollLock = (active = true) => {
  useEffect(() => {
    if (!active) return;
    const { body } = document;
    const prevOverflow     = body.style.overflow;
    const prevPaddingRight  = body.style.paddingRight;
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = 'hidden';
    if (scrollbarW > 0) body.style.paddingRight = `${scrollbarW}px`;

    return () => {
      body.style.overflow     = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [active]);
};
