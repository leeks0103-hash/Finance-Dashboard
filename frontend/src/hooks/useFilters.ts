import { useFilterStore } from '../store/filter.store';
import type { Filters } from '../types/finance.types';

export const useFilters = () => {
  const { year, parts, stages, setYear, togglePart, toggleStage, reset } = useFilterStore();
  const filters: Filters = { year, parts, stages };
  return { filters, setYear, togglePart, toggleStage, reset };
};
