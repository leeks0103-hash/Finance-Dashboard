import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * 재무·KPI 탭용 — year/part/stage 세 파라미터를 URL과 동기화
 * - mount 시: URL에 파라미터가 있으면 스토어에 적용 (공유 링크 수신)
 * - 필터 변경 시: URL을 replace (history 오염 없이 공유 가능한 주소 유지)
 */
export const useUrlFilterSync = (
  years: string[],
  parts: string[],
  stages: string[],
  applyFromUrl: (years: string[], parts: string[], stages: string[]) => void,
) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      const urlYears  = searchParams.getAll('year');
      const urlParts  = searchParams.getAll('part');
      const urlStages = searchParams.getAll('stage');
      if (urlYears.length || urlParts.length || urlStages.length) {
        applyFromUrl(urlYears, urlParts, urlStages);
        return;
      }
    }
    const p = new URLSearchParams();
    years.forEach(y  => p.append('year',  y));
    parts.forEach(v  => p.append('part',  v));
    stages.forEach(v => p.append('stage', v));
    setSearchParams(p, { replace: true });
  // applyFromUrl은 렌더마다 새 참조지만 mount 시 1회만 쓰므로 deps 제외
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [years, parts, stages]);
};

/**
 * 실적현황 탭용 — part 파라미터만 URL과 동기화
 */
export const useUrlPartSync = (
  parts: string[],
  applyFromUrl: (parts: string[]) => void,
) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      const urlParts = searchParams.getAll('part');
      if (urlParts.length) {
        applyFromUrl(urlParts);
        return;
      }
    }
    const p = new URLSearchParams();
    parts.forEach(v => p.append('part', v));
    setSearchParams(p, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts]);
};
