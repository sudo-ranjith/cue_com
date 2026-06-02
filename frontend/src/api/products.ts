import apiClient from './client';
import type { Product, ProductFormData, PaginatedResponse, ProductStatus } from '../types';

export interface ProductListParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: ProductStatus | '';
}

export const productsApi = {
  list: async (params: ProductListParams = {}): Promise<PaginatedResponse<Product>> => {
    const { data } = await apiClient.get<PaginatedResponse<Product>>('/products', { params });
    return data;
  },

  get: async (id: number): Promise<Product> => {
    const { data } = await apiClient.get<Product>(`/products/${id}`);
    return data;
  },

  create: async (payload: ProductFormData): Promise<Product> => {
    const { data } = await apiClient.post<Product>('/products', payload);
    return data;
  },

  update: async (id: number, payload: Partial<ProductFormData>): Promise<Product> => {
    const { data } = await apiClient.put<Product>(`/products/${id}`, payload);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/products/${id}`);
  },

  duplicate: async (id: number): Promise<Product> => {
    const { data } = await apiClient.post<Product>(`/products/${id}/duplicate`);
    return data;
  },

  getQrCode: async (id: number): Promise<{ qr_code_url: string }> => {
    const { data } = await apiClient.get(`/products/${id}/qr-code`);
    return data;
  },

  getByToken: async (token: string): Promise<Product> => {
    const { data } = await apiClient.get<Product>(`/public/products/${token}`);
    return data;
  },
};
