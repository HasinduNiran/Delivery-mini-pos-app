import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useMemo, useRef, useState } from 'react';
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
import type { Bill, BillsSummary, DisplayBill } from '@/api/types';
import { BillDetailSheet } from '@/components/BillDetailSheet';
import {
  type ChipOption,
  FilterChips,
  ListPlaceholder,
  PaginationBar,
  SearchBar,
  StatusBadge,
} from '@/components/ui';
import { useDebounced, usePagedList } from '@/hooks/usePagedList';
import { billLabel } from '@/lib/receipt';
import { serverToDisplay, syncPending } from '@/lib/sync';
import { pendingToDisplay, useOfflineBillsStore } from '@/store/offlineBillsStore';
import { formatDateTime, formatMoney } from '@/utils/format';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | 'paid' | 'credit' | 'settled';
type DateFilter = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'month';

const STATUS_OPTIONS: ChipOption<StatusFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'credit', label: 'Credit (unpaid)' },
  { value: 'settled', label: 'Settled' },
];

const DATE_OPTIONS: ChipOption<DateFilter>[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
];

// Local-time date range for a preset, as ISO strings for the API.
function dateRange(f: DateFilter): { from?: string; to?: string } {
  if (f === 'all') return {};
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(now);
  const daysBack = (n: number) => new Date(today.getTime() - n * 86400000);
  switch (f) {
    case 'today':
      return { from: today.toISOString() };
    case 'yesterday':
      return { from: daysBack(1).toISOString(), to: new Date(today.getTime() - 1).toISOString() };
    case '7d':
      return { from: daysBack(6).toISOString() };
    case '30d':
      return { from: daysBack(29).toISOString() };
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString() };
  }
}

function BillRow({
  bill,
  badge,
  onPress,
}: {
  bill: DisplayBill;
  badge: 'paid' | 'credit' | 'settled' | 'pending' | 'error';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-2 rounded-xl border border-slate-200 bg-white px-4 py-3 active:opacity-70">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-2 pr-2">
          <Text className="text-base font-bold text-slate-900">{billLabel(bill)}</Text>
          <StatusBadge status={badge} />
        </View>
        <Text className="text-base font-bold text-slate-900">{formatMoney(bill.total)}</Text>
      </View>
      <View className="mt-1 flex-row items-center justify-between">
        <Text className="flex-1 pr-2 text-sm text-slate-700" numberOfLines={1}>
          {bill.customerName || 'Walk-in customer'}
        </Text>
        {bill.amountDue > 0 ? (
          <Text className="text-sm font-bold text-red-600">
            Due {formatMoney(bill.amountDue)}
          </Text>
        ) : null}
      </View>
      <View className="mt-0.5 flex-row items-center justify-between">
        <Text className="text-xs text-slate-500">{formatDateTime(bill.createdAt)}</Text>
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
  const listRef = useRef<FlashListRef<Bill>>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<DisplayBill | null>(null);
  const [selectedPending, setSelectedPending] = useState<{ id: string; error: boolean } | null>(
    null,
  );
  const [syncing, setSyncing] = useState(false);
  const debouncedSearch = useDebounced(search.trim());

  const filterKey = JSON.stringify([debouncedSearch, status, dateFilter]);
  const list = usePagedList<Bill, BillsSummary>(
    (page) =>
      listBills({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: status === 'all' ? undefined : status,
        ...dateRange(dateFilter),
      }),
    filterKey,
  );

  const activeFilters = (status !== 'all' ? 1 : 0) + (dateFilter !== 'all' ? 1 : 0);
  const pendingCount = queue.length;
  const showPending = pendingCount > 0 && !debouncedSearch && activeFilters === 0;

  function goToPage(p: number) {
    list.setPage(p);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  async function handleSyncNow() {
    setSyncing(true);
    try {
      const res = await syncPending();
      list.reload();
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

  const pendingBill = useMemo(() => {
    if (!selectedPending) return null;
    const p = queue.find((q) => q.localId === selectedPending.id);
    return p ? pendingToDisplay(p) : null;
  }, [queue, selectedPending]);

  const summary = list.summary;

  return (
    <View className="flex-1 bg-slate-100" style={{ paddingTop: insets.top }}>
      <View className="gap-2 border-b border-slate-200 bg-white px-4 pb-3 pt-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-slate-900">Bills</Text>
          <Pressable
            onPress={() => setShowFilters((v) => !v)}
            className={`rounded-lg px-3 py-1.5 ${
              activeFilters > 0 ? 'bg-slate-900' : 'bg-slate-100'
            }`}>
            <Text
              className={`text-xs font-bold ${activeFilters > 0 ? 'text-white' : 'text-slate-700'}`}>
              ⚙ Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}
            </Text>
          </Pressable>
        </View>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Bill no (e.g. 12) or customer name"
        />
        {showFilters && (
          <View className="gap-2">
            <FilterChips options={STATUS_OPTIONS} value={status} onChange={setStatus} />
            <FilterChips options={DATE_OPTIONS} value={dateFilter} onChange={setDateFilter} />
          </View>
        )}
        {summary && (
          <View className="flex-row justify-between rounded-xl bg-slate-900 px-3 py-2">
            <View>
              <Text className="text-[10px] text-slate-400">BILLS</Text>
              <Text className="text-sm font-bold text-white">{summary.count}</Text>
            </View>
            <View>
              <Text className="text-[10px] text-slate-400">SALES</Text>
              <Text className="text-sm font-bold text-white">{formatMoney(summary.total)}</Text>
            </View>
            <View>
              <Text className="text-[10px] text-slate-400">PROFIT</Text>
              <Text className="text-sm font-bold text-emerald-400">
                {formatMoney(summary.profit)}
              </Text>
            </View>
            <View>
              <Text className="text-[10px] text-slate-400">UNPAID</Text>
              <Text className="text-sm font-bold text-amber-400">{formatMoney(summary.due)}</Text>
            </View>
          </View>
        )}
      </View>

      {showPending && (
        <View className="border-b border-amber-200 bg-amber-50 px-4 py-2">
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
          {queue.slice(0, 3).map((p) => (
            <View key={p.localId} className="mt-2">
              <BillRow
                bill={pendingToDisplay(p)}
                badge={p.status === 'error' ? 'error' : 'pending'}
                onPress={() =>
                  setSelectedPending({ id: p.localId, error: p.status === 'error' })
                }
              />
            </View>
          ))}
          {pendingCount > 3 && (
            <Text className="mt-1 text-xs text-amber-700">+ {pendingCount - 3} more</Text>
          )}
        </View>
      )}

      {list.data.length === 0 ? (
        <ListPlaceholder
          loading={list.loading}
          error={list.error}
          emoji="📜"
          message={
            debouncedSearch || activeFilters
              ? 'No bills match your search / filters.'
              : 'No bills issued yet.'
          }
          onRetry={list.reload}
        />
      ) : (
        <FlashList
          ref={listRef}
          data={list.data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />
          }
          renderItem={({ item }) => {
            const display = serverToDisplay(item);
            return (
              <BillRow
                bill={display}
                badge={display.status}
                onPress={() => setSelected(display)}
              />
            );
          }}
        />
      )}

      <PaginationBar
        pagination={list.pagination}
        onPage={goToPage}
        loading={list.loading}
        noun="bills"
      />

      <BillDetailSheet
        bill={selected}
        onClose={() => setSelected(null)}
        onChanged={() => list.reload()}
      />
      <BillDetailSheet
        bill={pendingBill}
        onClose={() => setSelectedPending(null)}
        extraActions={
          selectedPending?.error ? (
            <Pressable
              onPress={() => {
                const id = selectedPending.id;
                Alert.alert(
                  'Remove bill',
                  'The server rejected this bill (likely a stock conflict). Remove it from the queue?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => {
                        removePending(id);
                        setSelectedPending(null);
                      },
                    },
                  ],
                );
              }}
              className="items-center rounded-xl bg-red-50 py-3 active:opacity-70">
              <Text className="font-bold text-red-600">Remove failed bill</Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}
