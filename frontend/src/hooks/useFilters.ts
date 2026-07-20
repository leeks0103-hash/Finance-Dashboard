import { useFilterStore } from '@/store';
import type { Filters } from '@/types';

export const useFilters = () => {
  const { year, parts, stages, setYear, togglePart, toggleStage, reset } = useFilterStore();
  const filters: Filters = { year, parts, stages };
  return { filters, setYear, togglePart, toggleStage, reset };
};
