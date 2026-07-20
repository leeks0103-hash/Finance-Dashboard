import { getSummary } from '@/api';
import { createDataHook } from './createDataHook';

export const useSummary = createDataHook('summary', getSummary);
