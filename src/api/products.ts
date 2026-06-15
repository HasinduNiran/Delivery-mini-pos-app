import type { Product } from '@/store/cartStore';

import { apiRequest } from './client';
import type { Paginated } from './types';

type ListParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export function listProducts(params: ListParams = {}) {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.search) q.set('search', params.search);
  const qs = q.toString();
  return apiRequest<Paginated<Product>>(`/api/products${qs ? `?${qs}` : ''}`);
}

export type ProductInput = {
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  emoji?: string;
};

export function createProduct(input: ProductInput) {
  return apiRequest<Product>('/api/products', { method: 'POST', body: input });
}

export function updateProduct(id: string, input: Partial<ProductInput>) {
  return apiRequest<Product>(`/api/products/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

export function deleteProduct(id: string) {
  return apiRequest<{ ok: true }>(`/api/products/${id}`, { method: 'DELETE' });
}
