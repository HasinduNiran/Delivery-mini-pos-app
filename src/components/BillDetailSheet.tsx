import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { payBill } from '@/api/bills';
import type { DisplayBill } from '@/api/types';
import { PaperSizeToggle } from '@/components/PaperSizeToggle';
import { PaymentForm } from '@/components/PaymentForm';
import { KV, Sheet, StatusBadge } from '@/components/ui';
import { printReceipt, shareReceiptPdf } from '@/lib/print';
import { billLabel } from '@/lib/receipt';
import { serverToDisplay } from '@/lib/sync';
import { formatDateTime, formatMoney } from '@/utils/format';

// Full bill view: items, totals, payment history, print / share, and
// receiving payments on credit bills.
export function BillDetailSheet({
  bill,
  onClose,
  onChanged,
  extraActions,
}: {
  bill: DisplayBill | null;
  onClose: () => void;
  onChanged?: (updated: DisplayBill) => void;
  extraActions?: React.ReactNode;
}) {
  const [current, setCurrent] = useState<DisplayBill | null>(bill);
  const [shownId, setShownId] = useState<string | null>(bill?.id ?? null);
  const [busy, setBusy] = useState(false);

  // Follow the bill passed in (new bill opened).
  if ((bill?.id ?? null) !== shownId) {
    setShownId(bill?.id ?? null);
    setCurrent(bill);
  }

  if (!current) return null;
  const b = current;

  async function doPrint(method: 'print' | 'share') {
    setBusy(true);
    try {
      if (method === 'share') await shareReceiptPdf(b);
      else await printReceipt(b, 'system');
    } catch (err) {
      Alert.alert('Print failed', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function receive(amount: number) {
    const updated = serverToDisplay(await payBill(b.id, amount));
    setCurrent(updated);
    onChanged?.(updated);
    Alert.alert(
      'Payment saved',
      updated.status === 'settled'
        ? 'Bill fully paid.'
        : `Still owed: ${formatMoney(updated.amountDue)}`,
    );
  }

  return (
    <Sheet
      visible={!!bill}
      onClose={onClose}
      title={billLabel(b)}
      subtitle={formatDateTime(b.createdAt)}
      footer={
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-slate-500">Paper</Text>
            <PaperSizeToggle compact />
          </View>
          <View className="flex-row gap-2">
            <Pressable
              disabled={busy}
              onPress={() => doPrint('print')}
              className="flex-1 items-center rounded-xl bg-slate-900 py-3 active:opacity-80">
              <Text className="font-bold text-white">🖨️ Print</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => doPrint('share')}
              className="flex-1 items-center rounded-xl border border-slate-300 bg-white py-3 active:opacity-70">
              <Text className="font-semibold text-slate-700">Share PDF</Text>
            </Pressable>
          </View>
          {extraActions}
        </View>
      }>
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-base font-bold text-slate-900">
          {b.customerName || 'Walk-in customer'}
        </Text>
        <StatusBadge status={b.synced ? b.status : 'pending'} />
      </View>

      <View className="rounded-2xl bg-white p-4">
        {b.items.map((it, i) => (
          <View
            key={`${it.productId}-${i}`}
            className="flex-row border-b border-dashed border-slate-200 py-2">
            <View className="flex-1 pr-2">
              <Text className="text-sm text-slate-800">{it.name}</Text>
              <Text className="text-xs text-slate-500">
                {it.qty} × {formatMoney(it.price)}
              </Text>
            </View>
            <Text className="text-sm font-semibold text-slate-900">
              {formatMoney(it.qty * it.price)}
            </Text>
          </View>
        ))}
        <View className="mt-2">
          <KV label="Total" value={formatMoney(b.total)} strong />
          <KV label="Paid" value={formatMoney(b.cashReceived)} />
          {b.amountDue > 0 ? (
            <KV label="Balance due" value={formatMoney(b.amountDue)} strong tone="red" />
          ) : b.balance > 0 ? (
            <KV label="Change given" value={formatMoney(b.balance)} />
          ) : null}
          <KV label="Profit" value={formatMoney(b.profit)} tone="green" />
        </View>
      </View>

      {b.payments && b.payments.length > 0 && (
        <View className="mt-3 rounded-2xl bg-white p-4">
          <Text className="mb-1 text-sm font-semibold text-slate-700">
            Credit payments received
          </Text>
          {b.payments.map((p, i) => (
            <KV key={i} label={formatDateTime(p.at)} value={formatMoney(p.amount)} />
          ))}
        </View>
      )}

      {b.status === 'credit' && b.synced && b.amountDue > 0 && (
        <View className="mt-3">
          <PaymentForm due={b.amountDue} onSubmit={receive} />
        </View>
      )}
      {b.status === 'credit' && !b.synced && (
        <Text className="mt-3 text-xs text-amber-700">
          This bill is not synced yet. Payments can be recorded once it uploads.
        </Text>
      )}
    </Sheet>
  );
}
