import { getProjects } from '@/api';
import { createDataHook } from './createDataHook';

export const useProjects = createDataHook('projects', getProjects);
