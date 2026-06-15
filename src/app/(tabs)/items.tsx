import { FlashList } from '@shopify/flash-list';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProductsStore } from '@/store/productsStore';
import { formatMoney } from '@/utils/format';

export default function ItemsScreen() {
  const insets = useSafeAreaInsets();
  const products = useProductsStore((s) => s.products);
  const loading = useProductsStore((s) => s.loading);
  const loadProducts = useProductsStore((s) => s.loadProducts);
  const addProduct = useProductsStore((s) => s.addProduct);
  const removeProduct = useProductsStore((s) => s.removeProduct);

  const [name, setName] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [emoji, setEmoji] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const costNum = parseFloat(costPrice);
  const priceNum = parseFloat(price);
  const stockNum = parseInt(stock, 10);
  const canAdd =
    !saving &&
    name.trim().length > 0 &&
    costNum >= 0 &&
    priceNum > 0 &&
    stockNum >= 0 &&
    !Number.isNaN(costNum) &&
    !Number.isNaN(stockNum);

  async function handleAdd() {
    if (!canAdd) return;
    setSaving(true);
    try {
      await addProduct({
        name,
        price: priceNum,
        costPrice: costNum,
        stock: stockNum,
        emoji,
      });
      setName('');
      setCostPrice('');
      setPrice('');
      setStock('');
      setEmoji('');
      Keyboard.dismiss();
    } catch (err) {
      Alert.alert('Could not add item', (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: string, itemName: string) {
    Alert.alert('Delete item', `Remove "${itemName}" from the catalog?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeProduct(id).catch((err) =>
            Alert.alert('Could not delete', (err as Error).message),
          );
        },
      },
    ]);
  }

  return (
    <View className="flex-1 bg-slate-100" style={{ paddingTop: insets.top }}>
      <View className="border-b border-slate-200 bg-white px-4 py-3">
        <Text className="text-xl font-bold text-slate-900">Manage Items</Text>
        <Text className="text-sm text-slate-500">
          Add products to your catalog
        </Text>
      </View>

      {/* Add-item form */}
      <View className="gap-2 border-b border-slate-200 bg-white px-4 py-4">
        <View className="flex-row gap-2">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Item name"
            placeholderTextColor="#94a3b8"
            className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-base text-slate-900"
          />
          <TextInput
            value={emoji}
            onChangeText={setEmoji}
            placeholder="🛒"
            placeholderTextColor="#94a3b8"
            maxLength={2}
            className="w-14 rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-center text-base"
          />
        </View>
        <View className="flex-row gap-2">
          <TextInput
            value={costPrice}
            onChangeText={setCostPrice}
            placeholder="Cost price"
            placeholderTextColor="#94a3b8"
            keyboardType="decimal-pad"
            className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-base text-slate-900"
          />
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="Retail price"
            placeholderTextColor="#94a3b8"
            keyboardType="decimal-pad"
            className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-base text-slate-900"
          />
        </View>
        <View className="flex-row gap-2">
          <TextInput
            value={stock}
            onChangeText={setStock}
            placeholder="Quantity (stock)"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
            className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-base text-slate-900"
          />
          <Pressable
            disabled={!canAdd}
            onPress={handleAdd}
            className={`min-w-[88px] items-center justify-center rounded-xl px-6 active:opacity-80 ${
              canAdd ? 'bg-emerald-500' : 'bg-slate-300'
            }`}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-bold text-white">Add Item</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Existing items */}
      <FlashList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadProducts} />
        }
        renderItem={({ item }) => (
          <View className="mb-2 flex-row items-center rounded-xl border border-slate-200 bg-white px-4 py-3">
            <Text className="mr-3 text-2xl">{item.emoji ?? '🛒'}</Text>
            <View className="flex-1">
              <Text className="text-base font-semibold text-slate-800">
                {item.name}
              </Text>
              <Text className="text-sm font-bold text-emerald-600">
                {formatMoney(item.price)}
                <Text className="text-xs font-normal text-slate-400">
                  {'  '}cost {formatMoney(item.costPrice)}
                </Text>
              </Text>
              <Text
                className={`text-xs font-semibold ${
                  item.stock <= 0 ? 'text-red-500' : 'text-slate-500'
                }`}>
                Stock: {item.stock}
              </Text>
            </View>
            <Pressable
              onPress={() => handleDelete(item.id, item.name)}
              className="rounded-lg bg-red-50 px-3 py-2 active:opacity-70">
              <Text className="text-sm font-semibold text-red-600">Delete</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}
