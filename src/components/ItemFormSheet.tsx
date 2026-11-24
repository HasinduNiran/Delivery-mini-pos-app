import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';

import type { ProductInput } from '@/api/products';
import { Sheet } from '@/components/ui';
import type { Product } from '@/store/cartStore';
import { formatMoney } from '@/utils/format';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-1">
      <Text className="mb-1 text-xs font-semibold text-slate-600">{label}</Text>
      {children}
    </View>
  );
}

const inputCls =
  'rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900';

// Add a new item, or edit one (prices, stock, name, emoji).
export function ItemFormSheet({
  visible,
  item,
  onClose,
  onSave,
}: {
  visible: boolean;
  item: Product | null; // null = add new
  onClose: () => void;
  onSave: (data: ProductInput) => Promise<void>;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [emoji, setEmoji] = useState(item?.emoji ?? '');
  const [costPrice, setCostPrice] = useState(item ? String(item.costPrice) : '');
  const [price, setPrice] = useState(item ? String(item.price) : '');
  const [stock, setStock] = useState(item ? String(item.stock) : '');
  const [addStock, setAddStock] = useState('');
  const [saving, setSaving] = useState(false);

  const costNum = parseFloat(costPrice);
  const priceNum = parseFloat(price);
  const baseStock = parseInt(stock, 10);
  const addNum = parseInt(addStock, 10) || 0;
  const finalStock = (Number.isNaN(baseStock) ? 0 : baseStock) + addNum;
  const valid =
    name.trim().length > 0 &&
    !Number.isNaN(costNum) &&
    costNum >= 0 &&
    !Number.isNaN(priceNum) &&
    priceNum > 0 &&
    !Number.isNaN(baseStock) &&
    finalStock >= 0;
  const margin = valid ? priceNum - costNum : 0;

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        emoji: emoji.trim(), // empty -> server default 🛒
        costPrice: costNum,
        price: priceNum,
        stock: finalStock,
      });
      onClose();
    } catch (err) {
      Alert.alert('Could not save item', (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={item ? 'Edit item' : 'Add new item'}
      footer={
        <Pressable
          disabled={!valid || saving}
          onPress={save}
          className={`items-center rounded-xl py-3.5 active:opacity-80 ${
            valid ? 'bg-emerald-500' : 'bg-slate-300'
          }`}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-bold text-white">
              {item ? 'Save changes' : 'Add item'}
            </Text>
          )}
        </Pressable>
      }>
      <View className="gap-3">
        <View className="flex-row gap-2">
          <Field label="Item name">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. බුලත් (100)"
              placeholderTextColor="#94a3b8"
              className={inputCls}
            />
          </Field>
          <View className="w-16">
            <Text className="mb-1 text-xs font-semibold text-slate-600">Icon</Text>
            <TextInput
              value={emoji}
              onChangeText={setEmoji}
              placeholder="🛒"
              placeholderTextColor="#94a3b8"
              maxLength={8}
              className={`${inputCls} text-center`}
            />
          </View>
        </View>
        <View className="flex-row gap-2">
          <Field label="Cost price (buy)">
            <TextInput
              value={costPrice}
              onChangeText={setCostPrice}
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              keyboardType="decimal-pad"
              className={inputCls}
            />
          </Field>
          <Field label="Selling price">
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              keyboardType="decimal-pad"
              className={inputCls}
            />
          </Field>
        </View>
        {valid && (
          <Text className={`text-xs font-semibold ${margin < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            Profit per unit: {formatMoney(margin)}
            {costNum > 0 ? ` (${Math.round((margin / costNum) * 100)}%)` : ''}
          </Text>
        )}
        <View className="flex-row gap-2">
          <Field label={item ? 'Stock now' : 'Opening stock'}>
            <TextInput
              value={stock}
              onChangeText={setStock}
              placeholder="0"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              className={inputCls}
            />
          </Field>
          {item && (
            <Field label="+ Add new stock">
              <TextInput
                value={addStock}
                onChangeText={setAddStock}
                placeholder="0"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                className={inputCls}
              />
            </Field>
          )}
        </View>
        {item && addNum !== 0 && (
          <Text className="text-xs text-slate-600">New stock will be {finalStock}</Text>
        )}
      </View>
    </Sheet>
  );
}
