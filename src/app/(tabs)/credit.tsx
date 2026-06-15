import { FlashList } from '@shopify/flash-list';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listBills, settleBill } from '@/api/bills';
import type { Bill } from '@/api/types';
import { useOfflineBillsStore } from '@/store/offlineBillsStore';
import { formatMoney } from '@/utils/format';

const PAGE_SIZE = 20;

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

export default function CreditScreen() {
  const insets = useSafeAreaInsets();
  // Offline credit bills that haven't synced yet — shown but not settleable.
  const pendingCredit = useOfflineBillsStore((s) =>
    s.queue.filter((b) => b.paymentStatus === 'credit'),
  );

  const [bills, setBills] = useState<Bill[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (pageToLoad: number, replace: boolean) => {
    if (replace) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await listBills({
        page: pageToLoad,
        limit: PAGE_SIZE,
        status: 'credit',
      });
      setBills((prev) => (replace ? res.data : [...prev, ...res.data]));
      setHasMore(res.pagination.hasMore);
      setPage(pageToLoad);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(1, true);
  }, [fetchPage]);

  function loadMore() {
    if (loading || refreshing || !hasMore) return;
    fetchPage(page + 1, false);
  }

  function confirmSettle(bill: Bill) {
    const who = bill.customerName ? ` from ${bill.customerName}` : '';
    Alert.alert(
      'Mark as paid',
      `Received ${formatMoney(bill.amountDue)}${who} for Bill #${bill.billNo}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark paid', onPress: () => settle(bill.id) },
      ],
    );
  }

  async function settle(id: string) {
    setSettlingId(id);
    try {
      await settleBill(id);
      // Drop it from the outstanding list immediately.
      setBills((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      Alert.alert('Could not settle', (err as Error).message);
    } finally {
      setSettlingId(null);
    }
  }

  // Total still owed across everything currently visible.
  const outstanding = useMemo(() => {
    const synced = bills.reduce((sum, b) => sum + b.amountDue, 0);
    const offline = pendingCredit.reduce((sum, b) => sum + b.amountDue, 0);
    return synced + offline;
  }, [bills, pendingCredit]);

  const isEmpty =
    bills.length === 0 && pendingCredit.length === 0 && !loading && !refreshing;

  return (
    <View className="flex-1 bg-slate-100" style={{ paddingTop: insets.top }}>
      <View className="border-b border-slate-200 bg-white px-4 py-3">
        <Text className="text-xl font-bold text-slate-900">Credit Ledger</Text>
        <Text className="text-sm text-slate-500">
          Unpaid bills — mark as paid when settled
        </Text>
      </View>

      {/* Outstanding summary */}
      <View className="flex-row items-center justify-between border-b border-slate-200 bg-slate-900 px-4 py-3">
        <Text className="text-xs text-slate-400">Total outstanding</Text>
        <Text className="text-xl font-bold text-amber-400">
          {formatMoney(outstanding)}
        </Text>
      </View>

      {isEmpty ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-5xl">💳</Text>
          <Text className="mt-3 text-center text-base text-slate-500">
            {error ? `Couldn't load credit bills.\n${error}` : 'No outstanding credit. All settled!'}
          </Text>
        </View>
      ) : (
        <FlashList
          data={bills}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchPage(1, true)}
            />
          }
          ListHeaderComponent={
            pendingCredit.length > 0 ? (
              <View className="mb-2">
                {pendingCredit.map((b) => (
                  <View
                    key={b.localId}
                    className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-base font-semibold text-slate-900">
                        {b.customerName || b.localRef}
                      </Text>
                      <Text className="text-base font-bold text-red-600">
                        {formatMoney(b.amountDue)}
                      </Text>
                    </View>
                    <Text className="mt-1 text-xs text-amber-700">
                      Not synced yet — settle once it uploads.
                    </Text>
                  </View>
                ))}
              </View>
            ) : null
          }
          ListFooterComponent={
            loading && bills.length > 0 ? (
              <ActivityIndicator className="py-4" color="#10b981" />
            ) : null
          }
          renderItem={({ item }) => (
            <View className="mb-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-base font-bold text-slate-900">
                    {item.customerName || `Bill #${item.billNo}`}
                  </Text>
                  <Text className="mt-0.5 text-xs text-slate-500">
                    Bill #{item.billNo} · {formatWhen(item.createdAt)} ·{' '}
                    {item.itemCount} item{item.itemCount === 1 ? '' : 's'}
                  </Text>
                  <Text className="mt-1 text-xs text-slate-500">
                    Total {formatMoney(item.total)} · paid{' '}
                    {formatMoney(item.cashReceived)}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-lg font-bold text-red-600">
                    {formatMoney(item.amountDue)}
                  </Text>
                  <Text className="text-[10px] font-semibold uppercase text-slate-400">
                    due
                  </Text>
                </View>
              </View>
              <Pressable
                disabled={settlingId === item.id}
                onPress={() => confirmSettle(item)}
                className="mt-3 items-center rounded-lg bg-emerald-500 py-2.5 active:opacity-80">
                {settlingId === item.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-sm font-bold text-white">
                    Mark as paid
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}
