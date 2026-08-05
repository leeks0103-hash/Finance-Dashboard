import { useMemo } from 'react';
import { useFilterStore } from '@/store';
import type { Filters } from '@/types';

export const useFilters = () => {
  const { years, parts, stages, toggleYear, togglePart, toggleStage, reset } = useFilterStore();

  // M-7: 매 렌더마다 새 객체 생성 방지 — queryKey 안정성 보장
  const filters = useMemo<Filters>(
    () => ({ years, parts, stages }),
    [years, parts, stages]
  );

  return { filters, toggleYear, togglePart, toggleStage, reset };
};
