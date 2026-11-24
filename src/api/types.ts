// Shared shapes mirrored from the backend API responses.

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

export type Paginated<T, S = undefined> = {
  data: T[];
  pagination: Pagination;
  summary?: S;
};

// Totals across the whole filtered set (not just the current page).
export type BillsSummary = {
  count: number;
  total: number;
  profit: number;
  due: number;
};

export type CreditPayment = { amount: number; at: string };

// One row of the credit ledger: everything a customer still owes.
export type CreditCustomer = {
  key: string;
  name: string; // '' for credit bills saved without a name
  due: number;
  total: number;
  bills: number;
  oldest: string;
  latest: string;
};

export type CreditSummary = { due: number; bills: number; customers: number };

export type BillItem = {
  productId: string;
  name: string;
  emoji?: string;
  qty: number;
  price: number;
  costPrice: number;
};

export type BillStatus = 'paid' | 'credit' | 'settled';

export type Bill = {
  id: string;
  billNo: number;
  items: BillItem[];
  total: number;
  cost: number;
  profit: number;
  cashReceived: number;
  balance: number;
  amountDue: number;
  customerName?: string;
  status: BillStatus;
  settledAt?: string;
  payments?: CreditPayment[];
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

// A bill as shown in the UI / printed. Covers both synced server bills and
// bills created offline that haven't reached the server yet.
export type DisplayBill = {
  id: string; // server id, or local id for offline bills
  billNo: number | null; // assigned by the server; null until synced
  localRef?: string; // human label for offline bills (e.g. "OFF-1234")
  items: BillItem[];
  total: number;
  cost: number;
  profit: number;
  cashReceived: number;
  balance: number;
  amountDue: number; // outstanding credit (0 for fully paid bills)
  customerName?: string;
  status: BillStatus;
  payments?: CreditPayment[];
  settledAt?: string;
  itemCount: number;
  createdAt: string;
  synced: boolean;
};
