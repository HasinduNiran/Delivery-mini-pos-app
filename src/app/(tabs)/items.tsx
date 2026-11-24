import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ItemFormSheet } from '@/components/ItemFormSheet';
import {
  type ChipOption,
  FilterChips,
  ListPlaceholder,
  PaginationBar,
  SearchBar,
} from '@/components/ui';
import type { Product } from '@/store/cartStore';
import { useProductsStore } from '@/store/productsStore';
import { formatMoney } from '@/utils/format';

const PAGE_SIZE = 20;
const LOW_STOCK = 10;

type StockFilter = 'all' | 'in' | 'low' | 'out';
type SortBy = 'name' | 'stock' | 'price' | 'profit';

const STOCK_OPTIONS: ChipOption<StockFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'in', label: 'In stock' },
  { value: 'low', label: `Low stock (≤${LOW_STOCK})` },
  { value: 'out', label: 'Out of stock' },
];

const SORT_OPTIONS: ChipOption<SortBy>[] = [
  { value: 'name', label: 'A → Z' },
  { value: 'stock', label: 'Stock: low first' },
  { value: 'price', label: 'Price: high first' },
  { value: 'profit', label: 'Profit: high first' },
];

export default function ItemsScreen() {
  const insets = useSafeAreaInsets();
  const products = useProductsStore((s) => s.products);
  const loading = useProductsStore((s) => s.loading);
  const error = useProductsStore((s) => s.error);
  const loadProducts = useProductsStore((s) => s.loadProducts);
  const addProduct = useProductsStore((s) => s.addProduct);
  const editProduct = useProductsStore((s) => s.editProduct);
  const removeProduct = useProductsStore((s) => s.removeProduct);
  const listRef = useRef<FlashListRef<Product>>(null);

  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  // Refresh the catalog whenever the tab is opened.
  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts]),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (stockFilter === 'in') return p.stock > 0;
      if (stockFilter === 'low') return p.stock > 0 && p.stock <= LOW_STOCK;
      if (stockFilter === 'out') return p.stock <= 0;
      return true;
    });
    const by: Record<SortBy, (a: Product, b: Product) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      stock: (a, b) => a.stock - b.stock,
      price: (a, b) => b.price - a.price,
      profit: (a, b) => b.price - b.costPrice - (a.price - a.costPrice),
    };
    return list.sort(by[sortBy]);
  }, [products, search, stockFilter, sortBy]);

  // Reset to page 1 whenever the filters change.
  const filterKey = `${search}|${stockFilter}|${sortBy}`;
  const [lastKey, setLastKey] = useState(filterKey);
  if (filterKey !== lastKey) {
    setLastKey(filterKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const stats = useMemo(() => {
    let low = 0;
    let out = 0;
    let value = 0;
    for (const p of products) {
      if (p.stock <= 0) out += 1;
      else if (p.stock <= LOW_STOCK) low += 1;
      value += Math.max(0, p.stock) * p.costPrice;
    }
    return { low, out, value };
  }, [products]);

  const activeFilters = (stockFilter !== 'all' ? 1 : 0) + (sortBy !== 'name' ? 1 : 0);

  function openForm(item: Product | null) {
    setEditing(item);
    setFormKey((k) => k + 1); // fresh form state each time
    setFormOpen(true);
  }

  function goToPage(p: number) {
    setPage(p);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  function handleDelete(item: Product) {
    Alert.alert('Delete item', `Remove "${item.name}" from the catalog?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeProduct(item.id).catch((err) =>
            Alert.alert('Could not delete', (err as Error).message),
          );
        },
      },
    ]);
  }

  return (
    <View className="flex-1 bg-slate-100" style={{ paddingTop: insets.top }}>
      <View className="gap-2 border-b border-slate-200 bg-white px-4 pb-3 pt-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-slate-900">Items</Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setShowFilters((v) => !v)}
              className={`rounded-lg px-3 py-1.5 ${
                activeFilters > 0 ? 'bg-slate-900' : 'bg-slate-100'
              }`}>
              <Text
                className={`text-xs font-bold ${
                  activeFilters > 0 ? 'text-white' : 'text-slate-700'
                }`}>
                ⚙ Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => openForm(null)}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 active:opacity-80">
              <Text className="text-xs font-bold text-white">+ Add item</Text>
            </Pressable>
          </View>
        </View>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search items" />
        {showFilters && (
          <View className="gap-2">
            <FilterChips options={STOCK_OPTIONS} value={stockFilter} onChange={setStockFilter} />
            <FilterChips options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} />
          </View>
        )}
        <View className="flex-row justify-between rounded-xl bg-slate-900 px-3 py-2">
          <View>
            <Text className="text-[10px] text-slate-400">ITEMS</Text>
            <Text className="text-sm font-bold text-white">{products.length}</Text>
          </View>
          <Pressable onPress={() => setStockFilter('low')}>
            <Text className="text-[10px] text-slate-400">LOW STOCK</Text>
            <Text className="text-sm font-bold text-amber-400">{stats.low}</Text>
          </Pressable>
          <Pressable onPress={() => setStockFilter('out')}>
            <Text className="text-[10px] text-slate-400">OUT</Text>
            <Text className="text-sm font-bold text-red-400">{stats.out}</Text>
          </Pressable>
          <View>
            <Text className="text-[10px] text-slate-400">STOCK VALUE</Text>
            <Text className="text-sm font-bold text-emerald-400">{formatMoney(stats.value)}</Text>
          </View>
        </View>
      </View>

      {error && products.length > 0 && (
        <View className="bg-amber-100 px-4 py-2">
          <Text className="text-xs text-amber-800">
            Offline — showing saved items. Pull down to retry.
          </Text>
        </View>
      )}

      {pageItems.length === 0 ? (
        <ListPlaceholder
          loading={loading && products.length === 0}
          error={products.length === 0 ? error : null}
          emoji="📦"
          message={
            products.length === 0
              ? 'No items yet. Tap “+ Add item”.'
              : 'No items match your search / filters.'
          }
          onRetry={loadProducts}
        />
      ) : (
        <FlashList
          ref={listRef}
          data={pageItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadProducts} />}
          renderItem={({ item }) => {
            const out = item.stock <= 0;
            const low = !out && item.stock <= LOW_STOCK;
            return (
              <Pressable
                onPress={() => openForm(item)}
                className="mb-2 flex-row items-center rounded-xl border border-slate-200 bg-white px-4 py-3 active:opacity-70">
                <Text className="mr-3 text-2xl">{item.emoji ?? '🛒'}</Text>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-slate-800" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="text-sm font-bold text-emerald-600">
                    {formatMoney(item.price)}
                    <Text className="text-xs font-normal text-slate-400">
                      {'  '}cost {formatMoney(item.costPrice)} · profit{' '}
                      {formatMoney(item.price - item.costPrice)}
                    </Text>
                  </Text>
                  <Text
                    className={`text-xs font-semibold ${
                      out ? 'text-red-500' : low ? 'text-amber-600' : 'text-slate-500'
                    }`}>
                    {out ? 'Out of stock' : `Stock: ${item.stock}${low ? ' · low' : ''}`}
                  </Text>
                </View>
                <View className="gap-1.5">
                  <Pressable
                    onPress={() => openForm(item)}
                    className="items-center rounded-lg bg-slate-100 px-3 py-1.5 active:opacity-70">
                    <Text className="text-xs font-semibold text-slate-700">Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(item)}
                    className="items-center rounded-lg bg-red-50 px-3 py-1.5 active:opacity-70">
                    <Text className="text-xs font-semibold text-red-600">Delete</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <PaginationBar
        pagination={{ page: safePage, totalPages, total: filtered.length }}
        onPage={goToPage}
        noun="items"
      />

      <ItemFormSheet
        key={formKey}
        visible={formOpen}
        item={editing}
        onClose={() => setFormOpen(false)}
        onSave={(data) => (editing ? editProduct(editing.id, data) : addProduct(data))}
      />
    </View>
  );
}
