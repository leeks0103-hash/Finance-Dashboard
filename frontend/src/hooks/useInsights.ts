import { getInsights } from '@/api';
import { createDataHook } from './createDataHook';

export const useInsights = createDataHook('insights', getInsights);
