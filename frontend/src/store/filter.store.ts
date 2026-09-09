import { createFilterStore } from './createFilterStore';

// v2 — knownYears/Parts/Stages 필드 추가(syncOptions 도입)로 저장 스키마가 바뀌어 1회 초기화
export const useFilterStore = createFilterStore('finance-filter-store-v2');
