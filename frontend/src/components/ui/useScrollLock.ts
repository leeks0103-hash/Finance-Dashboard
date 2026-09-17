import { useEffect } from 'react';

/**
 * 모달이 열린 동안 body 스크롤 잠금.
 *
 * 스크롤바 폭 보정은 필요 없음 — index.css의 `html { scrollbar-gutter: stable }`가
 * 이미 스크롤바 자리를 항상 예약해두고 있어서, overflow를 hidden으로 바꿔도 폭이
 * 안 변함(스크롤바가 있다 없어져도 그 자리는 계속 비어있는 상태로 남음). 예전엔 여기서
 * 스크롤바 폭만큼 padding-right를 추가로 더했는데, 그게 오히려 이미 예약된 공간 위에
 * 또 폭을 빼서 모달 열 때마다 헤더가 옆으로 밀리는 원인이었음(2026-09-17 발견).
 *
 * @param active true인 동안 잠금 (보통 모달 open 상태)
 */
export const useScrollLock = (active = true) => {
  useEffect(() => {
    if (!active) return;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prevOverflow;
    };
  }, [active]);
};
