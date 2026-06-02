import apiClient from './client';
import type { Order, PaginatedResponse, OrderStatus, CreateOrderRequest, CreateOrderResponse } from '../types';

export interface OrderListParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: OrderStatus | '';
}

export const ordersApi = {
  list: async (params: OrderListParams = {}): Promise<PaginatedResponse<Order>> => {
    const { data } = await apiClient.get<PaginatedResponse<Order>>('/orders', { params });
    return data;
  },

  get: async (id: number): Promise<Order> => {
    const { data } = await apiClient.get<Order>(`/orders/${id}`);
    return data;
  },

  updateStatus: async (id: number, status: OrderStatus, note?: string): Promise<Order> => {
    const { data } = await apiClient.patch<Order>(`/orders/${id}/status`, { status, note });
    return data;
  },

  downloadInvoice: async (id: number): Promise<Blob> => {
    const { data } = await apiClient.get(`/orders/${id}/invoice`, {
      responseType: 'blob',
    });
    return data;
  },

  exportCsv: async (params: OrderListParams = {}): Promise<Blob> => {
    const { data } = await apiClient.get('/orders/export', {
      params,
      responseType: 'blob',
    });
    return data;
  },

  createPublic: async (payload: CreateOrderRequest): Promise<CreateOrderResponse> => {
    const { data } = await apiClient.post<CreateOrderResponse>('/public/orders', payload);
    return data;
  },

  track: async (orderNumber: string, phone: string): Promise<Order> => {
    const { data } = await apiClient.get<Order>('/public/track', {
      params: { order_number: orderNumber, phone },
    });
    return data;
  },
};
