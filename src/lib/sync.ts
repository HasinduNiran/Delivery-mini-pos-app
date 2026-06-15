import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

import { createBill } from '@/api/bills';
import { ApiError } from '@/api/client';
import type { Bill, BillItem, DisplayBill } from '@/api/types';
import {
  pendingToDisplay,
  useOfflineBillsStore,
  type PendingBill,
} from '@/store/offlineBillsStore';
import { useProductsStore } from '@/store/productsStore';

const round2 = (n: number) => Math.round(n * 100) / 100;

type SaleInput = {
  items: { productId: string; qty: number }[];
  cashReceived: number;
  customerName?: string;
};

// Doubles as the sale's idempotency key, so it needs enough entropy that two
// distinct sales never collide: timestamp + two random base36 chunks.
function genLocalId(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}${rand()}${rand()}`;
}

// Treat "unknown" reachability as online and let the request itself decide —
// avoids false negatives that would force everything offline.
async function isOnline(): Promise<boolean> {
  try {
    const s = await NetInfo.fetch();
    return !!s.isConnected && s.isInternetReachable !== false;
  } catch {
    return true;
  }
}

// Build a priced snapshot from the cached catalog and validate local stock,
// so an offline sale can be printed and synced exactly as captured.
function buildSnapshot(items: SaleInput['items']) {
  const products = useProductsStore.getState().products;
  const byId = new Map(products.map((p) => [p.id, p]));

  const qtyById = new Map<string, number>();
  for (const it of items) {
    qtyById.set(it.productId, (qtyById.get(it.productId) || 0) + it.qty);
  }

  const billItems: BillItem[] = [];
  let total = 0;
  let cost = 0;
  let itemCount = 0;
  for (const [id, qty] of qtyById) {
    const p = byId.get(id);
    if (!p) throw new Error('An item is missing from the local catalog.');
    if (p.stock < qty) {
      throw new Error(`Not enough stock for "${p.name}" (have ${p.stock}).`);
    }
    billItems.push({
      productId: id,
      name: p.name,
      emoji: p.emoji,
      qty,
      price: p.price,
      costPrice: p.costPrice,
    });
    total += p.price * qty;
    cost += p.costPrice * qty;
    itemCount += qty;
  }

  return {
    billItems,
    total: round2(total),
    cost: round2(cost),
    profit: round2(total - cost),
    itemCount,
  };
}

export function serverToDisplay(b: Bill): DisplayBill {
  return {
    id: b.id,
    billNo: b.billNo,
    items: b.items,
    total: b.total,
    cost: b.cost,
    profit: b.profit,
    cashReceived: b.cashReceived,
    balance: b.balance,
    // Fall back for bills created before credit support shipped.
    amountDue: b.amountDue ?? Math.max(0, round2(b.total - b.cashReceived)),
    customerName: b.customerName,
    status: b.status ?? (b.cashReceived < b.total ? 'credit' : 'paid'),
    itemCount: b.itemCount,
    createdAt: b.createdAt,
    synced: true,
  };
}

// Complete a sale: try the server first; on no/failed connectivity, save it
// locally and queue it for sync. Stock is reduced locally either way.
export async function submitSale(
  input: SaleInput,
): Promise<{ bill: DisplayBill; offline: boolean }> {
  const snapshot = buildSnapshot(input.items); // validates local stock

  // One idempotency key for this sale. It's reused for the online attempt and,
  // if that attempt's response is lost, for the queued retry — so the server
  // can recognize the two as the same bill and never create a duplicate.
  const clientId = genLocalId();

  if (await isOnline()) {
    try {
      const serverBill = await createBill({ ...input, clientId });
      useProductsStore.getState().applyStockAfterBill(input.items);
      return { bill: serverToDisplay(serverBill), offline: false };
    } catch (err) {
      // A real server rejection (bad request, stock conflict) must surface —
      // only network/timeout errors (status 0) fall back to offline.
      if (err instanceof ApiError && err.status !== 0) throw err;
    }
  }

  const createdAt = new Date().toISOString();
  const localId = clientId; // doubles as the idempotency key on later sync
  const cashReceived = round2(input.cashReceived);
  const amountDue = round2(Math.max(0, snapshot.total - cashReceived));
  const pending: PendingBill = {
    localId,
    localRef: `OFF-${localId.slice(-4).toUpperCase()}`,
    items: snapshot.billItems,
    total: snapshot.total,
    cost: snapshot.cost,
    profit: snapshot.profit,
    cashReceived,
    balance: round2(cashReceived - snapshot.total),
    amountDue,
    customerName: input.customerName?.trim() || undefined,
    paymentStatus: amountDue > 0 ? 'credit' : 'paid',
    itemCount: snapshot.itemCount,
    createdAt,
    status: 'pending',
  };

  useOfflineBillsStore.getState().enqueue(pending);
  useProductsStore.getState().applyStockAfterBill(input.items);
  return { bill: pendingToDisplay(pending), offline: true };
}

let syncing = false;

// Flush queued offline bills to the server, oldest first. Server-rejected
// bills (e.g. stock conflicts) are flagged 'error' and left for manual review.
export async function syncPending(): Promise<{ synced: number; failed: number }> {
  if (syncing) return { synced: 0, failed: 0 };
  const queue = useOfflineBillsStore.getState().queue;
  const toSync = queue.filter((b) => b.status === 'pending');
  if (toSync.length === 0) return { synced: 0, failed: 0 };
  if (!(await isOnline())) return { synced: 0, failed: 0 };

  syncing = true;
  let synced = 0;
  let failed = 0;
  try {
    for (const b of [...toSync].reverse()) {
      try {
        await createBill({
          items: b.items.map((i) => ({ productId: i.productId, qty: i.qty })),
          cashReceived: b.cashReceived,
          customerName: b.customerName,
          clientId: b.localId, // idempotency key set when the sale was queued
        });
        useOfflineBillsStore.getState().remove(b.localId);
        synced += 1;
      } catch (err) {
        if (err instanceof ApiError && err.status === 0) break; // lost network
        useOfflineBillsStore
          .getState()
          .setStatus(b.localId, 'error', (err as Error).message);
        failed += 1;
      }
    }
  } finally {
    syncing = false;
  }

  // Refresh authoritative stock (loadProducts re-applies any still-queued
  // deductions so the on-screen counts stay consistent).
  await useProductsStore.getState().loadProducts();
  return { synced, failed };
}

// Auto-sync queued bills whenever the device is likely back online: on launch,
// when connectivity is (re)gained, and when the app returns to the foreground
// (a backgrounded JS context can miss the NetInfo event). Returns a combined
// unsubscribe function. syncPending is internally guarded against overlap.
export function startConnectivitySync(): () => void {
  syncPending();

  const unsubscribeNet = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      syncPending();
    }
  });

  const appStateSub = AppState.addEventListener('change', (next) => {
    if (next === 'active') syncPending();
  });

  return () => {
    unsubscribeNet();
    appStateSub.remove();
  };
}
