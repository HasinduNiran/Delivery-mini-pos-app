import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listBills, listCreditCustomers, payCustomer } from '@/api/bills';
import type { Bill, BillsSummary, CreditCustomer, CreditSummary, DisplayBill } from '@/api/types';
import { BillDetailSheet } from '@/components/BillDetailSheet';
import { PaymentForm } from '@/components/PaymentForm';
import {
  type ChipOption,
  ListPlaceholder,
  PaginationBar,
  SearchBar,
  Segmented,
  Sheet,
  StatusBadge,
} from '@/components/ui';
import { useDebounced, usePagedList } from '@/hooks/usePagedList';
import { billLabel } from '@/lib/receipt';
import { serverToDisplay } from '@/lib/sync';
import { useOfflineBillsStore } from '@/store/offlineBillsStore';
import { daysAgo, formatDate, formatMoney } from '@/utils/format';

const PAGE_SIZE = 20;
const NO_NAME = 'No name';

type View_ = 'customers' | 'unpaid' | 'history';
const VIEWS: ChipOption<View_>[] = [
  { value: 'customers', label: 'Customers' },
  { value: 'unpaid', label: 'Unpaid bills' },
  { value: 'history', label: 'Paid history' },
];

// Placeholder page for the list that isn't on screen (avoids extra requests).
const emptyPage = () =>
  Promise.resolve({
    data: [],
    pagination: { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1, hasMore: false },
  });

function ageLabel(iso: string): string {
  const d = daysAgo(iso);
  if (d === 0) return 'today';
  if (d === 1) return '1 day';
  return `${d} days`;
}

// ---- Customer ledger sheet ---------------------------------------------------
function CustomerSheet({
  customer,
  onClose,
  onChanged,
  onOpenBill,
}: {
  customer: CreditCustomer | null;
  onClose: () => void;
  onChanged: () => void;
  onOpenBill: (b: DisplayBill) => void;
}) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const name = customer?.name ?? null;

  useEffect(() => {
    if (name === null) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true);
        return listBills({ status: 'credit', customer: name, limit: 100 });
      })
      .then((res) => !cancelled && setBills(res.data))
      .catch((err: Error) => !cancelled && Alert.alert('Could not load bills', err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [name, nonce]);

  if (!customer) return null;
  const due = bills.length ? bills.reduce((s, b) => s + b.amountDue, 0) : customer.due;

  async function receive(amount: number) {
    const res = await payCustomer(customer!.name, amount);
    onChanged();
    setNonce((n) => n + 1);
    const cleared = res.applied.filter((a) => a.settled).length;
    Alert.alert(
      'Payment saved',
      `${formatMoney(res.paid)} received.\n` +
        (cleared ? `${cleared} bill${cleared === 1 ? '' : 's'} fully paid.\n` : '') +
        (res.remaining > 0 ? `Still owed: ${formatMoney(res.remaining)}` : 'All bills cleared! 🎉'),
    );
    if (res.remaining <= 0) onClose();
  }

  return (
    <Sheet
      visible
      onClose={onClose}
      title={customer.name || NO_NAME}
      subtitle={`${customer.bills} unpaid bill${customer.bills === 1 ? '' : 's'} · oldest ${formatDate(customer.oldest)}`}>
      <View className="mb-3 items-center rounded-2xl bg-slate-900 py-4">
        <Text className="text-xs text-slate-400">Total owed</Text>
        <Text className="text-3xl font-bold text-amber-400">{formatMoney(due)}</Text>
      </View>

      <PaymentForm
        due={Math.round(due * 100) / 100}
        onSubmit={receive}
        label="Receive payment (oldest bills are cleared first)"
      />

      <Text className="mb-1 mt-4 text-sm font-semibold text-slate-700">Unpaid bills</Text>
      {loading && bills.length === 0 ? (
        <ActivityIndicator className="py-6" color="#10b981" />
      ) : (
        bills.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => onOpenBill(serverToDisplay(b))}
            className="mb-2 flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 active:opacity-70">
            <View>
              <Text className="text-sm font-bold text-slate-900">{billLabel(serverToDisplay(b))}</Text>
              <Text className="text-xs text-slate-500">
                {formatDate(b.createdAt)} · {ageLabel(b.createdAt)} · total {formatMoney(b.total)}
              </Text>
            </View>
            <Text className="text-sm font-bold text-red-600">{formatMoney(b.amountDue)}</Text>
          </Pressable>
        ))
      )}
    </Sheet>
  );
}

export default function CreditScreen() {
  const insets = useSafeAreaInsets();
  const queue = useOfflineBillsStore((s) => s.queue);
  const pendingCredit = useMemo(
    () => queue.filter((b) => b.paymentStatus === 'credit'),
    [queue],
  );
  const pendingDue = pendingCredit.reduce((s, b) => s + b.amountDue, 0);

  const [view, setView] = useState<View_>('customers');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search.trim());
  const [customer, setCustomer] = useState<CreditCustomer | null>(null);
  const [bill, setBill] = useState<DisplayBill | null>(null);

  // Overall totals (all unpaid bills, not just this page).
  const [totals, setTotals] = useState<CreditSummary | null>(null);
  const [totalsNonce, setTotalsNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    listCreditCustomers({ limit: 1 })
      .then((r) => !cancelled && r.summary && setTotals(r.summary))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [totalsNonce]);
  useFocusEffect(useCallback(() => setTotalsNonce((n) => n + 1), []));

  const customers = usePagedList<CreditCustomer, CreditSummary>(
    (page) =>
      view !== 'customers'
        ? emptyPage()
        : listCreditCustomers({ page, limit: PAGE_SIZE, search: debouncedSearch || undefined }),
    `c:${view === 'customers'}:${debouncedSearch}`,
  );
  const billsList = usePagedList<Bill, BillsSummary>(
    (page) =>
      view === 'customers'
        ? emptyPage()
        : listBills({
            page,
            limit: PAGE_SIZE,
            status: view === 'unpaid' ? 'credit' : 'settled',
            search: debouncedSearch || undefined,
          }),
    `b:${view}:${debouncedSearch}`,
  );

  function refreshAll() {
    setTotalsNonce((n) => n + 1);
    customers.reload();
    billsList.reload();
  }

  const active = view === 'customers' ? customers : billsList;

  return (
    <View className="flex-1 bg-slate-100" style={{ paddingTop: insets.top }}>
      <View className="gap-2 border-b border-slate-200 bg-white px-4 pb-3 pt-3">
        <Text className="text-xl font-bold text-slate-900">Credit Ledger</Text>

        <View className="flex-row items-center justify-between rounded-2xl bg-slate-900 px-4 py-3">
          <View>
            <Text className="text-xs text-slate-400">Total outstanding</Text>
            <Text className="text-2xl font-bold text-amber-400">
              {totals ? formatMoney(totals.due + pendingDue) : '—'}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-slate-300">
              {totals ? `${totals.customers} customer${totals.customers === 1 ? '' : 's'}` : ''}
            </Text>
            <Text className="text-xs text-slate-300">
              {totals ? `${totals.bills + pendingCredit.length} unpaid bills` : ''}
            </Text>
          </View>
        </View>

        <Segmented
          options={VIEWS}
          value={view}
          onChange={(v) => {
            setView(v);
          }}
        />
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder={view === 'customers' ? 'Search customer / shop' : 'Bill no or customer name'}
        />
      </View>

      {pendingCredit.length > 0 && view !== 'history' && (
        <View className="border-b border-amber-200 bg-amber-50 px-4 py-2">
          <Text className="text-xs font-semibold text-amber-800">
            {pendingCredit.length} offline credit bill{pendingCredit.length === 1 ? '' : 's'} (
            {formatMoney(pendingDue)}) not synced yet — included in the total, payments can be
            taken once they upload.
          </Text>
        </View>
      )}

      {active.data.length === 0 ? (
        <ListPlaceholder
          loading={active.loading}
          error={active.error}
          emoji={view === 'history' ? '📗' : '💳'}
          message={
            debouncedSearch
              ? 'Nothing matches your search.'
              : view === 'history'
                ? 'No credit bills have been paid off yet.'
                : 'No outstanding credit. All settled! 🎉'
          }
          onRetry={active.reload}
        />
      ) : view === 'customers' ? (
        <FlashList
          data={customers.data}
          keyExtractor={(c) => c.key}
          contentContainerStyle={{ padding: 12 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={customers.refreshing}
              onRefresh={() => {
                setTotalsNonce((n) => n + 1);
                customers.refresh();
              }}
            />
          }
          renderItem={({ item }) => {
            const age = daysAgo(item.oldest);
            return (
              <Pressable
                onPress={() => setCustomer(item)}
                className="mb-2 rounded-xl border border-slate-200 bg-white px-4 py-3 active:opacity-70">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
                      {item.name || NO_NAME}
                    </Text>
                    <Text className="mt-0.5 text-xs text-slate-500">
                      {item.bills} unpaid bill{item.bills === 1 ? '' : 's'} · oldest{' '}
                      {formatDate(item.oldest)}
                    </Text>
                    <Text
                      className={`mt-0.5 text-xs font-semibold ${
                        age > 30 ? 'text-red-600' : age > 7 ? 'text-amber-600' : 'text-slate-400'
                      }`}>
                      Owing for {ageLabel(item.oldest)}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-lg font-bold text-red-600">{formatMoney(item.due)}</Text>
                    <Text className="text-[11px] font-semibold text-emerald-600">
                      Receive payment ›
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      ) : (
        <FlashList
          data={billsList.data}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: 12 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={billsList.refreshing}
              onRefresh={() => {
                setTotalsNonce((n) => n + 1);
                billsList.refresh();
              }}
            />
          }
          renderItem={({ item }) => {
            const d = serverToDisplay(item);
            return (
              <Pressable
                onPress={() => setBill(d)}
                className="mb-2 rounded-xl border border-slate-200 bg-white px-4 py-3 active:opacity-70">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
                        {item.customerName || NO_NAME}
                      </Text>
                      <StatusBadge status={d.status} />
                    </View>
                    <Text className="mt-0.5 text-xs text-slate-500">
                      {billLabel(d)} · {formatDate(item.createdAt)}
                      {view === 'history' && item.settledAt
                        ? ` · paid ${formatDate(item.settledAt)}`
                        : ` · ${ageLabel(item.createdAt)}`}
                    </Text>
                    <Text className="mt-0.5 text-xs text-slate-500">
                      Total {formatMoney(item.total)} · paid {formatMoney(item.cashReceived)}
                    </Text>
                  </View>
                  {view === 'unpaid' ? (
                    <View className="items-end">
                      <Text className="text-lg font-bold text-red-600">
                        {formatMoney(item.amountDue)}
                      </Text>
                      <Text className="text-[11px] font-semibold text-emerald-600">
                        Receive payment ›
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-base font-bold text-emerald-600">
                      {formatMoney(item.total)}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <PaginationBar
        pagination={active.pagination}
        onPage={active.setPage}
        loading={active.loading}
        noun={view === 'customers' ? 'customers' : 'bills'}
      />

      {customer && (
        <CustomerSheet
          customer={customer}
          onClose={() => setCustomer(null)}
          onChanged={refreshAll}
          onOpenBill={(b) => {
            setCustomer(null);
            setBill(b);
          }}
        />
      )}
      <BillDetailSheet bill={bill} onClose={() => setBill(null)} onChanged={refreshAll} />
    </View>
  );
}
