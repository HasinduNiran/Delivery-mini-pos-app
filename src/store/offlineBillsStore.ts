import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { BillItem, DisplayBill } from '@/api/types';
import { persistStorage } from '@/store/persistStorage';

// A sale captured on-device while offline (or when the server was
// unreachable). It carries a full snapshot of prices/costs so it can be
// printed immediately and synced verbatim later.
export type PendingBill = {
  localId: string;
  localRef: string; // short human label, e.g. "OFF-8842"
  items: BillItem[];
  total: number;
  cost: number;
  profit: number;
  cashReceived: number;
  balance: number;
  amountDue: number; // outstanding credit (0 for fully paid)
  customerName?: string;
  // Payment status captured at sale time. 'settled' only happens server-side.
  paymentStatus: 'paid' | 'credit';
  itemCount: number;
  createdAt: string;
  status: 'pending' | 'error'; // sync state, not payment state
  error?: string;
};

type OfflineBillsState = {
  queue: PendingBill[];
  hydrated: boolean;
  enqueue: (bill: PendingBill) => void;
  remove: (localId: string) => void;
  setStatus: (localId: string, status: PendingBill['status'], error?: string) => void;
};

export const useOfflineBillsStore = create<OfflineBillsState>()(
  persist(
    (set) => ({
      queue: [],
      hydrated: false,

      enqueue: (bill) => set((s) => ({ queue: [bill, ...s.queue] })),

      remove: (localId) =>
        set((s) => ({ queue: s.queue.filter((b) => b.localId !== localId) })),

      setStatus: (localId, status, error) =>
        set((s) => ({
          queue: s.queue.map((b) =>
            b.localId === localId ? { ...b, status, error } : b,
          ),
        })),
    }),
    {
      name: 'flowiix-offline-bills',
      storage: persistStorage,
      partialize: (s) => ({ queue: s.queue }),
      onRehydrateStorage: () => () => {
        useOfflineBillsStore.setState({ hydrated: true });
      },
    },
  ),
);

// Map a queued bill to the unified shape used for display and printing.
export function pendingToDisplay(p: PendingBill): DisplayBill {
  return {
    id: p.localId,
    billNo: null,
    localRef: p.localRef,
    items: p.items,
    total: p.total,
    cost: p.cost,
    profit: p.profit,
    cashReceived: p.cashReceived,
    balance: p.balance,
    amountDue: p.amountDue,
    customerName: p.customerName,
    status: p.paymentStatus,
    itemCount: p.itemCount,
    createdAt: p.createdAt,
    synced: false,
  };
}

// Flatten all queued bills into per-product quantities so callers can offset
// server stock by sales that haven't synced yet.
export function pendingDeductions(
  queue: PendingBill[],
): { productId: string; qty: number }[] {
  const byId = new Map<string, number>();
  for (const bill of queue) {
    for (const item of bill.items) {
      byId.set(item.productId, (byId.get(item.productId) || 0) + item.qty);
    }
  }
  return [...byId.entries()].map(([productId, qty]) => ({ productId, qty }));
}
