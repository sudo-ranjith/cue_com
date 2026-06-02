import apiClient from './client';
import type { LoginResponse, ForgotPasswordFormData, ResetPasswordFormData, User } from '../types';

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const { data } = await apiClient.post<LoginResponse>('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  getMe: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/auth/me');
    return data;
  },

  forgotPassword: async (payload: ForgotPasswordFormData): Promise<{ message: string }> => {
    const { data } = await apiClient.post('/auth/forgot-password', payload);
    return data;
  },

  resetPassword: async (payload: ResetPasswordFormData): Promise<{ message: string }> => {
    const { data } = await apiClient.post('/auth/reset-password', payload);
    return data;
  },

  refreshToken: async (refreshToken: string): Promise<{ access_token: string }> => {
    const { data } = await apiClient.post('/auth/refresh', { refresh_token: refreshToken });
    return data;
  },
};
