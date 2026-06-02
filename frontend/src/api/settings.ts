import apiClient from './client';
import type { AppSettings, CompanySettings, PaymentSettings, NotificationSettings } from '../types';

export const settingsApi = {
  get: async (): Promise<AppSettings> => {
    const { data } = await apiClient.get<AppSettings>('/settings');
    return data;
  },

  updateCompany: async (payload: Partial<CompanySettings>): Promise<CompanySettings> => {
    const { data } = await apiClient.put<CompanySettings>('/settings/company', payload);
    return data;
  },

  updatePayment: async (payload: Partial<PaymentSettings>): Promise<PaymentSettings> => {
    const { data } = await apiClient.put<PaymentSettings>('/settings/payment', payload);
    return data;
  },

  updateNotification: async (payload: Partial<NotificationSettings>): Promise<NotificationSettings> => {
    const { data } = await apiClient.put<NotificationSettings>('/settings/notification', payload);
    return data;
  },
};
