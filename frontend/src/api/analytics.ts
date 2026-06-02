import apiClient from './client';
import type { DashboardData } from '../types';

export const analyticsApi = {
  getDashboard: async (): Promise<DashboardData> => {
    const { data } = await apiClient.get<DashboardData>('/analytics/dashboard');
    return data;
  },
};
