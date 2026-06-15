import { FlashList } from '@shopify/flash-list';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listBills } from '@/api/bills';
import type { Bill, DisplayBill } from '@/api/types';
import { printReceipt, shareReceiptPdf } from '@/lib/print';
import { serverToDisplay, syncPending } from '@/lib/sync';
import {
  pendingToDisplay,
  useOfflineBillsStore,
} from '@/store/offlineBillsStore';
import { formatMoney } from '@/utils/format';

const PAGE_SIZE = 20;

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function BillRow({
  bill,
  badge,
  onPress,
}: {
  bill: DisplayBill;
  badge?: { text: string; tone: 'amber' | 'red' };
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-2 rounded-xl border border-slate-200 bg-white px-4 py-3 active:opacity-70">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-bold text-slate-900">
            {bill.billNo != null ? `Bill #${bill.billNo}` : bill.localRef}
          </Text>
          {badge && (
            <Text
              className={`overflow-hidden rounded-full px-2 py-0.5 text-[10px] font-bold ${
                badge.tone === 'red'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
              {badge.text}
            </Text>
          )}
        </View>
        <Text className="text-base font-bold text-emerald-600">
          {formatMoney(bill.total)}
        </Text>
      </View>
      <View className="mt-1 flex-row items-center justify-between">
        <Text className="text-xs text-slate-500">
          {formatWhen(bill.createdAt)}
        </Text>
        <Text className="text-xs text-slate-500">
          {bill.itemCount} item{bill.itemCount === 1 ? '' : 's'} · profit{' '}
          {formatMoney(bill.profit)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function BillsScreen() {
  const insets = useSafeAreaInsets();
  const queue = useOfflineBillsStore((s) => s.queue);
  const removePending = useOfflineBillsStore((s) => s.remove);

  const [bills, setBills] = useState<Bill[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (pageToLoad: number, replace: boolean) => {
    if (replace) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await listBills({ page: pageToLoad, limit: PAGE_SIZE });
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

  async function handleSyncNow() {
    setSyncing(true);
    try {
      const res = await syncPending();
      await fetchPage(1, true);
      if (res.synced || res.failed) {
        Alert.alert(
          'Sync finished',
          `${res.synced} uploaded${res.failed ? `, ${res.failed} failed` : ''}.`,
        );
      } else {
        Alert.alert('Nothing to sync', 'No pending bills, or still offline.');
      }
    } finally {
      setSyncing(false);
    }
  }

  function openReprint(bill: DisplayBill) {
    const label = bill.billNo != null ? `Bill #${bill.billNo}` : bill.localRef;
    Alert.alert(label ?? 'Bill', `Total ${formatMoney(bill.total)}`, [
      { text: 'Print', onPress: () => reprint(bill, 'print') },
      { text: 'Share PDF', onPress: () => reprint(bill, 'share') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function openPending(bill: DisplayBill, isError: boolean) {
    Alert.alert(
      bill.localRef ?? 'Offline bill',
      isError
        ? 'This bill was rejected by the server (likely a stock conflict). Print it, or remove it from the queue.'
        : 'Not synced yet. It will upload automatically when online.',
      [
        { text: 'Print', onPress: () => reprint(bill, 'print') },
        { text: 'Share PDF', onPress: () => reprint(bill, 'share') },
        ...(isError
          ? [
              {
                text: 'Remove',
                style: 'destructive' as const,
                onPress: () => removePending(bill.id),
              },
            ]
          : []),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  }

  async function reprint(bill: DisplayBill, method: 'print' | 'share') {
    try {
      if (method === 'share') await shareReceiptPdf(bill);
      else await printReceipt(bill, 'system');
    } catch (err) {
      Alert.alert('Print failed', (err as Error).message);
    }
  }

  const pendingCount = queue.length;

  return (
    <View className="flex-1 bg-slate-100" style={{ paddingTop: insets.top }}>
      <View className="border-b border-slate-200 bg-white px-4 py-3">
        <Text className="text-xl font-bold text-slate-900">Bills</Text>
        <Text className="text-sm text-slate-500">
          Tap a bill to print or re-print
        </Text>
      </View>

      {/* Pending offline bills */}
      {pendingCount > 0 && (
        <View className="border-b border-amber-200 bg-amber-50 px-4 py-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-amber-800">
              {pendingCount} bill{pendingCount === 1 ? '' : 's'} waiting to sync
            </Text>
            <Pressable
              disabled={syncing}
              onPress={handleSyncNow}
              className="rounded-lg bg-amber-500 px-3 py-1.5 active:opacity-80">
              {syncing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-xs font-bold text-white">Sync now</Text>
              )}
            </Pressable>
          </View>
          {queue.map((p) => (
            <View key={p.localId} className="mt-2">
              <BillRow
                bill={pendingToDisplay(p)}
                badge={
                  p.status === 'error'
                    ? { text: 'FAILED', tone: 'red' }
                    : { text: 'NOT SYNCED', tone: 'amber' }
                }
                onPress={() =>
                  openPending(pendingToDisplay(p), p.status === 'error')
                }
              />
            </View>
          ))}
        </View>
      )}

      {loading && bills.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      ) : bills.length === 0 && pendingCount === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-5xl">📜</Text>
          <Text className="mt-3 text-center text-base text-slate-500">
            {error ? `Couldn't load bills.\n${error}` : 'No bills issued yet.'}
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
          ListFooterComponent={
            loading && bills.length > 0 ? (
              <ActivityIndicator className="py-4" color="#10b981" />
            ) : !hasMore && bills.length > 0 ? (
              <Text className="py-4 text-center text-xs text-slate-400">
                — end of bills —
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            const display = serverToDisplay(item);
            const badge =
              display.status === 'credit'
                ? { text: 'CREDIT', tone: 'red' as const }
                : undefined;
            return (
              <BillRow
                bill={display}
                badge={badge}
                onPress={() => openReprint(display)}
              />
            );
          }}
        />
      )}
    </View>
  );
}
