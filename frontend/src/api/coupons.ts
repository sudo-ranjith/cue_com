import apiClient from './client';
import type { Coupon, CouponFormData, PaginatedResponse, CouponValidateResponse } from '../types';

export const couponsApi = {
  list: async (params: { page?: number; per_page?: number } = {}): Promise<PaginatedResponse<Coupon>> => {
    const { data } = await apiClient.get<PaginatedResponse<Coupon>>('/coupons', { params });
    return data;
  },

  create: async (payload: CouponFormData): Promise<Coupon> => {
    const { data } = await apiClient.post<Coupon>('/coupons', payload);
    return data;
  },

  update: async (id: number, payload: Partial<CouponFormData>): Promise<Coupon> => {
    const { data } = await apiClient.put<Coupon>(`/coupons/${id}`, payload);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/coupons/${id}`);
  },

  toggle: async (id: number, isActive: boolean): Promise<Coupon> => {
    const { data } = await apiClient.patch<Coupon>(`/coupons/${id}/toggle`, { is_active: isActive });
    return data;
  },

  validate: async (code: string, productId: number, quantity: number): Promise<CouponValidateResponse> => {
    const { data } = await apiClient.post<CouponValidateResponse>('/public/coupons/validate', {
      code,
      product_id: productId,
      quantity,
    });
    return data;
  },
};
