import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';

import { formatMoney } from '@/utils/format';

// Amount entry for receiving a credit payment (partial or full).
export function PaymentForm({
  due,
  onSubmit,
  label = 'Receive payment',
}: {
  due: number;
  onSubmit: (amount: number) => Promise<void>;
  label?: string;
}) {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const value = Math.round((parseFloat(amount) || 0) * 100) / 100;
  const tooMuch = value > due + 0.001;
  const valid = value > 0 && !tooMuch;

  function submit() {
    if (!valid || saving) return;
    const remaining = Math.max(0, due - value);
    Alert.alert(
      'Confirm payment',
      `Received ${formatMoney(value)}.\n${
        remaining > 0 ? `Still owed: ${formatMoney(remaining)}` : 'This clears the full balance.'
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            setSaving(true);
            try {
              await onSubmit(value);
              setAmount('');
            } catch (err) {
              Alert.alert('Payment not saved', (err as Error).message);
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }

  return (
    <View className="rounded-2xl border border-emerald-200 bg-white p-4">
      <Text className="mb-2 text-sm font-semibold text-slate-700">{label}</Text>
      <View className="flex-row gap-2">
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="Amount received"
          placeholderTextColor="#94a3b8"
          keyboardType="decimal-pad"
          className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-lg text-slate-900"
        />
        <Pressable
          onPress={() => setAmount(String(due))}
          className="justify-center rounded-xl bg-slate-100 px-3 active:opacity-70">
          <Text className="text-xs font-bold text-slate-700">Full{'\n'}amount</Text>
        </Pressable>
      </View>
      {tooMuch ? (
        <Text className="mt-1 text-xs font-semibold text-red-600">
          More than the balance due ({formatMoney(due)})
        </Text>
      ) : value > 0 ? (
        <Text className="mt-1 text-xs text-slate-500">
          Balance after payment: {formatMoney(Math.max(0, due - value))}
        </Text>
      ) : null}
      <Pressable
        disabled={!valid || saving}
        onPress={submit}
        className={`mt-3 items-center rounded-xl py-3 active:opacity-80 ${
          valid ? 'bg-emerald-500' : 'bg-slate-300'
        }`}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-bold text-white">Save payment</Text>
        )}
      </Pressable>
    </View>
  );
}
