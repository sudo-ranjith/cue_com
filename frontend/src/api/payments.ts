import apiClient from './client';
import type { RazorpayOrderResponse, VerifyPaymentRequest } from '../types';

export const paymentsApi = {
  createRazorpayOrder: async (orderId: number): Promise<RazorpayOrderResponse> => {
    const { data } = await apiClient.post<RazorpayOrderResponse>('/payments/create-order', {
      order_id: orderId,
    });
    return data;
  },

  verifyPayment: async (payload: VerifyPaymentRequest): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.post('/payments/verify', payload);
    return data;
  },
};
