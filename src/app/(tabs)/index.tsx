import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ItemCard } from '@/components/ItemCard';
import type { Product } from '@/store/cartStore';
import {
  selectTotalAmount,
  selectTotalCount,
  useCartStore,
} from '@/store/cartStore';
import { useProductsStore } from '@/store/productsStore';
import { formatMoney } from '@/utils/format';

export default function BillingScreen() {
  const insets = useSafeAreaInsets();
  const products = useProductsStore((s) => s.products);
  const loading = useProductsStore((s) => s.loading);
  const error = useProductsStore((s) => s.error);
  const loadProducts = useProductsStore((s) => s.loadProducts);
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const totalCount = useCartStore(selectTotalCount);
  const totalAmount = useCartStore(selectTotalAmount);

  // Fetch the catalog from the backend on mount (cache shows instantly).
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Quantity prompt state — opens when an item is tapped.
  const [selected, setSelected] = useState<Product | null>(null);
  const [qty, setQty] = useState('1');

  // How many of this product can still be added (stock minus what's
  // already in the cart).
  const inCart = selected ? (cartItems[selected.id]?.qty ?? 0) : 0;
  const available = selected ? selected.stock - inCart : 0;

  const qtyNum = parseInt(qty, 10);
  const validQty =
    !Number.isNaN(qtyNum) && qtyNum >= 1 && qtyNum <= available;

  function openQtyPrompt(product: Product) {
    setSelected(product);
    setQty('1');
  }

  function closeQtyPrompt() {
    setSelected(null);
  }

  function confirmAdd() {
    if (!selected || !validQty) return;
    addItem(selected, qtyNum);
    closeQtyPrompt();
  }

  function stepQty(delta: number) {
    const next = (Number.isNaN(qtyNum) ? 0 : qtyNum) + delta;
    if (next < 1) return;
    if (next > available) return;
    setQty(String(next));
  }

  return (
    <View className="flex-1 bg-slate-100" style={{ paddingTop: insets.top }}>
      <View className="border-b border-slate-200 bg-white px-4 py-3">
        <Text className="text-xl font-bold text-slate-900">Flowiix POS</Text>
        <Text className="text-sm text-slate-500">
          Tap items to build the bill
        </Text>
      </View>

      {error && products.length > 0 && (
        <View className="bg-amber-100 px-4 py-2">
          <Text className="text-xs text-amber-800">
            Offline — showing saved catalog. Pull down to retry.
          </Text>
        </View>
      )}

      {loading && products.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#10b981" />
          <Text className="mt-3 text-sm text-slate-500">Loading items…</Text>
        </View>
      ) : products.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-5xl">📦</Text>
          <Text className="mt-3 text-center text-base text-slate-500">
            {error
              ? `Couldn't load items.\n${error}`
              : 'No items yet. Add some on the Items tab.'}
          </Text>
          <Pressable
            onPress={loadProducts}
            className="mt-4 rounded-xl bg-emerald-500 px-6 py-3 active:opacity-80">
            <Text className="font-bold text-white">Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={products}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 8 }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadProducts} />
          }
          renderItem={({ item }) => (
            <ItemCard product={item} onPress={() => openQtyPrompt(item)} />
          )}
        />
      )}

      <View
        className="flex-row items-center gap-3 bg-slate-900 px-4 py-3"
        style={{ paddingBottom: 12 }}>
        <View className="flex-1">
          <Text className="text-xs text-slate-400">
            {totalCount} item{totalCount === 1 ? '' : 's'}
          </Text>
          <Text className="text-xl font-bold text-white">
            {formatMoney(totalAmount)}
          </Text>
        </View>
        <Pressable
          disabled={totalCount === 0}
          onPress={() => router.push('/bill')}
          className={`rounded-xl px-6 py-3 active:opacity-80 ${
            totalCount === 0 ? 'bg-slate-700' : 'bg-emerald-500'
          }`}>
          <Text className="text-base font-bold text-white">Issue Bill</Text>
        </Pressable>
      </View>

      {/* Quantity prompt */}
      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={closeQtyPrompt}>
        <Pressable
          onPress={closeQtyPrompt}
          className="flex-1 items-center justify-center bg-black/40 px-6">
          {/* Stop taps inside the card from closing the modal. */}
          <Pressable
            onPress={() => {}}
            className="w-full rounded-2xl bg-white p-5">
            {selected && (
              <>
                <View className="items-center">
                  <Text className="text-4xl">{selected.emoji ?? '🛒'}</Text>
                  <Text className="mt-2 text-lg font-bold text-slate-900">
                    {selected.name}
                  </Text>
                  <Text className="text-sm font-semibold text-emerald-600">
                    {formatMoney(selected.price)}
                  </Text>
                  <Text className="mt-1 text-xs text-slate-400">
                    {available} available
                    {inCart > 0 ? ` · ${inCart} in cart` : ''}
                  </Text>
                </View>

                <Text className="mt-4 mb-1 text-sm font-medium text-slate-600">
                  Quantity
                </Text>
                <View className="flex-row items-center gap-3">
                  <Pressable
                    onPress={() => stepQty(-1)}
                    className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100 active:opacity-70">
                    <Text className="text-2xl font-bold text-slate-700">−</Text>
                  </Pressable>
                  <TextInput
                    value={qty}
                    onChangeText={setQty}
                    keyboardType="number-pad"
                    selectTextOnFocus
                    className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-center text-xl font-bold text-slate-900"
                  />
                  <Pressable
                    onPress={() => stepQty(1)}
                    className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100 active:opacity-70">
                    <Text className="text-2xl font-bold text-slate-700">+</Text>
                  </Pressable>
                </View>

                <View className="mt-5 flex-row gap-3">
                  <Pressable
                    onPress={closeQtyPrompt}
                    className="flex-1 items-center rounded-xl bg-slate-100 py-3 active:opacity-70">
                    <Text className="text-base font-semibold text-slate-600">
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={!validQty}
                    onPress={confirmAdd}
                    className={`flex-1 items-center rounded-xl py-3 active:opacity-80 ${
                      validQty ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}>
                    <Text className="text-base font-bold text-white">
                      Add to cart
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
