import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DisplayBill } from '@/api/types';
import { ApiError } from '@/api/client';
import { printReceipt, shareReceiptPdf } from '@/lib/print';
import { submitSale } from '@/lib/sync';
import { selectTotalAmount, useCartStore } from '@/store/cartStore';
import { formatMoney } from '@/utils/format';

export default function BillScreen() {
  const insets = useSafeAreaInsets();
  const items = useCartStore((s) => s.items);
  const total = useCartStore(selectTotalAmount);
  const clearCart = useCartStore((s) => s.clearCart);

  const lines = Object.values(items);
  const [cash, setCash] = useState('');
  const [customerName, setCustomerName] = useState('');
  const cashNum = parseFloat(cash) || 0;
  const balance = cashNum - total;
  const isCredit = cashNum < total; // short payment => sold on credit
  const amountDue = isCredit ? total - cashNum : 0;

  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<DisplayBill | null>(null);
  const [printing, setPrinting] = useState(false);

  async function completeSale() {
    if (submitting) return;
    setSubmitting(true);
    const sold = lines.map((line) => ({
      productId: line.product.id,
      qty: line.qty,
    }));
    try {
      // Saves to the server if online, otherwise queues locally. Stock is
      // reduced locally either way, so the app works fully offline. A cash
      // amount below the total records a credit sale.
      const { bill } = await submitSale({
        items: sold,
        cashReceived: cashNum,
        customerName: customerName.trim() || undefined,
      });
      clearCart();
      setCompleted(bill);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : (err as Error).message;
      Alert.alert('Could not complete sale', message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePrint(method: 'system' | 'share') {
    if (!completed) return;
    setPrinting(true);
    try {
      if (method === 'share') await shareReceiptPdf(completed);
      else await printReceipt(completed, 'system');
    } catch (err) {
      Alert.alert('Print failed', (err as Error).message);
    } finally {
      setPrinting(false);
    }
  }

  // ---- Success screen (after the bill is saved) --------------------------
  if (completed) {
    return (
      <View className="flex-1 bg-slate-100">
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View className="items-center py-6">
            <Text className="text-6xl">{completed.synced ? '✅' : '📥'}</Text>
            <Text className="mt-3 text-xl font-bold text-slate-900">
              {completed.status === 'credit' ? 'Credit Sale Saved' : 'Sale Complete'}
            </Text>
            {completed.synced ? (
              <Text className="text-sm text-slate-500">
                Bill #{completed.billNo} saved
              </Text>
            ) : (
              <View className="mt-1 items-center">
                <Text className="text-sm text-amber-600">
                  Saved offline ({completed.localRef})
                </Text>
                <Text className="text-xs text-slate-400">
                  Will sync automatically when back online
                </Text>
              </View>
            )}
          </View>

          <View className="rounded-2xl bg-white p-4">
            <View className="flex-row justify-between py-1">
              <Text className="text-slate-600">Total</Text>
              <Text className="font-bold text-slate-900">
                {formatMoney(completed.total)}
              </Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-slate-600">Cash received</Text>
              <Text className="text-slate-900">
                {formatMoney(completed.cashReceived)}
              </Text>
            </View>
            {completed.customerName ? (
              <View className="flex-row justify-between py-1">
                <Text className="text-slate-600">Customer</Text>
                <Text className="text-slate-900">{completed.customerName}</Text>
              </View>
            ) : null}
            {completed.amountDue > 0 ? (
              <View className="flex-row justify-between border-t border-dashed border-slate-200 py-1 pt-2">
                <Text className="font-medium text-slate-700">Balance due</Text>
                <Text className="font-bold text-red-600">
                  {formatMoney(completed.amountDue)}
                </Text>
              </View>
            ) : (
              <View className="flex-row justify-between py-1">
                <Text className="text-slate-600">Change</Text>
                <Text className="font-bold text-emerald-600">
                  {formatMoney(completed.balance)}
                </Text>
              </View>
            )}
          </View>

          <Pressable
            disabled={printing}
            onPress={() => handlePrint('system')}
            className="mt-4 flex-row items-center justify-center rounded-xl bg-slate-900 py-4 active:opacity-80">
            {printing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-bold text-white">
                🖨️  Print Receipt
              </Text>
            )}
          </Pressable>
          <Pressable
            disabled={printing}
            onPress={() => handlePrint('share')}
            className="mt-3 items-center rounded-xl border border-slate-300 bg-white py-4 active:opacity-70">
            <Text className="text-base font-semibold text-slate-700">
              Share / Save PDF
            </Text>
          </Pressable>
        </ScrollView>

        <View
          className="border-t border-slate-200 bg-white px-4 py-3"
          style={{ paddingBottom: insets.bottom + 12 }}>
          <Pressable
            onPress={() => router.back()}
            className="items-center rounded-xl bg-emerald-500 py-4 active:opacity-80">
            <Text className="text-base font-bold text-white">New Sale</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---- Empty cart --------------------------------------------------------
  if (lines.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-100 px-6">
        <Text className="text-5xl">🧾</Text>
        <Text className="mt-3 text-center text-base text-slate-500">
          No items in the cart yet. Add items from the Billing screen.
        </Text>
      </View>
    );
  }

  // ---- Cart / checkout ---------------------------------------------------
  return (
    <View className="flex-1 bg-slate-100">
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="items-center pb-4">
          <Text className="text-lg font-bold text-slate-900">Flowiix Store</Text>
          <Text className="text-xs text-slate-500">Sales Bill</Text>
        </View>

        <View className="rounded-2xl bg-white p-4">
          {lines.map((line) => (
            <View
              key={line.product.id}
              className="flex-row items-center border-b border-dashed border-slate-200 py-2">
              <Text className="flex-1 text-sm text-slate-800" numberOfLines={1}>
                {line.product.emoji} {line.product.name}
              </Text>
              <Text className="w-20 text-right text-xs text-slate-500">
                {line.qty} × {formatMoney(line.product.price)}
              </Text>
              <Text className="w-24 text-right text-sm font-semibold text-slate-900">
                {formatMoney(line.qty * line.product.price)}
              </Text>
            </View>
          ))}

          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-base font-bold text-slate-900">Total</Text>
            <Text className="text-xl font-bold text-emerald-600">
              {formatMoney(total)}
            </Text>
          </View>
        </View>

        {/* Cash & balance */}
        <View className="mt-4 rounded-2xl bg-white p-4">
          <Text className="mb-1 text-sm font-medium text-slate-600">
            Cash received
          </Text>
          <TextInput
            value={cash}
            onChangeText={setCash}
            placeholder="0.00"
            placeholderTextColor="#94a3b8"
            keyboardType="decimal-pad"
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-lg text-slate-900"
          />
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-base font-medium text-slate-700">
              {isCredit ? 'Balance due (credit)' : 'Change'}
            </Text>
            <Text
              className={`text-lg font-bold ${
                isCredit ? 'text-red-600' : 'text-slate-900'
              }`}>
              {formatMoney(isCredit ? amountDue : balance)}
            </Text>
          </View>
        </View>

        {/* Customer (required for credit so the debt can be tracked) */}
        {isCredit && (
          <View className="mt-4 rounded-2xl bg-white p-4">
            <Text className="mb-1 text-sm font-medium text-slate-600">
              Customer name
            </Text>
            <TextInput
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Who owes this balance?"
              placeholderTextColor="#94a3b8"
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-base text-slate-900"
            />
            <Text className="mt-2 text-xs text-amber-600">
              This sale will be recorded as credit and listed in the ledger
              until it’s settled.
            </Text>
          </View>
        )}
      </ScrollView>

      <View
        className="border-t border-slate-200 bg-white px-4 py-3"
        style={{ paddingBottom: insets.bottom + 12 }}>
        <Pressable
          disabled={submitting}
          onPress={completeSale}
          className={`items-center rounded-xl py-4 active:opacity-80 ${
            submitting ? 'bg-slate-300' : isCredit ? 'bg-amber-500' : 'bg-emerald-500'
          }`}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-bold text-white">
              {isCredit
                ? `Save Credit Bill · ${formatMoney(amountDue)} due`
                : 'Complete Sale'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
