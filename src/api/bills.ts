import { apiRequest } from './client';
import type { Bill, Paginated } from './types';

export type CreateBillInput = {
  items: { productId: string; qty: number }[];
  cashReceived: number;
  customerName?: string;
  clientId?: string; // idempotency key — dedupes retried/queued sales
};

export function createBill(input: CreateBillInput) {
  return apiRequest<Bill>('/api/bills', { method: 'POST', body: input });
}

export function listBills(
  params: { page?: number; limit?: number; status?: string } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.status) q.set('status', params.status);
  const qs = q.toString();
  return apiRequest<Paginated<Bill>>(`/api/bills${qs ? `?${qs}` : ''}`);
}

export function getBill(id: string) {
  return apiRequest<Bill>(`/api/bills/${id}`);
}

// Mark a credit bill as paid in full.
export function settleBill(id: string) {
  return apiRequest<Bill>(`/api/bills/${id}/settle`, { method: 'PATCH' });
}
