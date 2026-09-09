import { createFilterStore } from './createFilterStore';

// v2 — knownYears/Parts/Stages 필드 추가(syncOptions 도입)로 저장 스키마가 바뀌어 1회 초기화.
// 기존에 저장된 필터가 파트 "-"(파트 미인식 2건) 등 나중에 생긴 옵션값을 놓치고 있던 문제도 이 참에 해소
export const useKpiFilterStore = createFilterStore('kpi-filter-store-v2');
