import { apiRequest } from './client';
import type {
  Bill,
  BillsSummary,
  CreditCustomer,
  CreditSummary,
  Paginated,
} from './types';

export type CreateBillInput = {
  items: { productId: string; qty: number }[];
  cashReceived: number;
  customerName?: string;
  clientId?: string; // idempotency key — dedupes retried/queued sales
};

export function createBill(input: CreateBillInput) {
  return apiRequest<Bill>('/api/bills', { method: 'POST', body: input });
}

export type BillFilters = {
  page?: number;
  limit?: number;
  status?: string; // 'paid' | 'credit' | 'settled' (comma separated)
  search?: string; // bill number (12, #12, INV-2026-012) or customer name
  customer?: string; // exact customer name
  from?: string; // ISO date-time
  to?: string; // ISO date-time
};

function toQuery(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const qs = q.toString();
  return qs ? `?${qs}` : '';
}

export function listBills(params: BillFilters = {}) {
  return apiRequest<Paginated<Bill, BillsSummary>>(
    `/api/bills${toQuery(params)}`,
  );
}

export function getBill(id: string) {
  return apiRequest<Bill>(`/api/bills/${id}`);
}

// Mark a credit bill as paid in full.
export function settleBill(id: string) {
  return apiRequest<Bill>(`/api/bills/${id}/settle`, { method: 'PATCH' });
}

// Record a partial or full payment against one credit bill.
export function payBill(id: string, amount: number) {
  return apiRequest<Bill>(`/api/bills/${id}/payments`, {
    method: 'POST',
    body: { amount },
  });
}

// Outstanding credit grouped per customer, with overall totals.
export function listCreditCustomers(
  params: { page?: number; limit?: number; search?: string } = {},
) {
  return apiRequest<Paginated<CreditCustomer, CreditSummary>>(
    `/api/bills/credit/customers${toQuery(params)}`,
  );
}

export type CustomerPaymentResult = {
  applied: { id: string; billNo: number; amount: number; settled: boolean }[];
  paid: number;
  remaining: number;
};

// Lump-sum payment from a customer, applied to their oldest bills first.
export function payCustomer(name: string, amount: number) {
  return apiRequest<CustomerPaymentResult>('/api/bills/credit/customers/pay', {
    method: 'POST',
    body: { name, amount },
  });
}

// Previously used customer names, for suggestions.
export function listCustomerNames(search = '') {
  return apiRequest<{ data: string[] }>(
    `/api/bills/customers${toQuery({ search, limit: 6 })}`,
    { timeoutMs: 6000 },
  );
}
