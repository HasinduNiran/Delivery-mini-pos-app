import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BillStatus, Pagination } from '@/api/types';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';

// ---- Search box ------------------------------------------------------------
export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search…',
}: {
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <View className="flex-row items-center rounded-xl border border-slate-300 bg-slate-50 px-3">
      <Text className="mr-2 text-base text-slate-400">🔍</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        autoCorrect={false}
        returnKeyType="search"
        className="flex-1 py-2.5 text-base text-slate-900"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} className="pl-2">
          <Text className="text-base font-bold text-slate-400">✕</Text>
        </Pressable>
      )}
    </View>
  );
}

// ---- Horizontal filter chips -----------------------------------------------
export type ChipOption<V extends string> = { value: V; label: string };

export function FilterChips<V extends string>({
  options,
  value,
  onChange,
}: {
  options: ChipOption<V>[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: 6 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            className={`rounded-full border px-3 py-1.5 ${
              active ? 'border-slate-900 bg-slate-900' : 'border-slate-300 bg-white'
            }`}>
            <Text
              className={`text-xs font-semibold ${
                active ? 'text-white' : 'text-slate-600'
              }`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---- Segmented tabs ----------------------------------------------------------
export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: ChipOption<V>[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <View className="flex-row rounded-xl bg-slate-200 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            className={`flex-1 items-center rounded-lg py-2 ${active ? 'bg-white' : ''}`}>
            <Text
              className={`text-sm font-semibold ${
                active ? 'text-slate-900' : 'text-slate-500'
              }`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---- Prev / Next pagination --------------------------------------------------
export function PaginationBar({
  pagination,
  onPage,
  loading,
  noun = 'records',
}: {
  pagination: Pick<Pagination, 'page' | 'totalPages' | 'total'> | null;
  onPage: (page: number) => void;
  loading?: boolean;
  noun?: string;
}) {
  if (!pagination || pagination.total === 0) return null;
  const { page, totalPages, total } = pagination;
  const canPrev = page > 1 && !loading;
  const canNext = page < totalPages && !loading;
  return (
    <View className="flex-row items-center justify-between border-t border-slate-200 bg-white px-3 py-2">
      <Pressable
        disabled={!canPrev}
        onPress={() => onPage(page - 1)}
        className={`rounded-lg px-4 py-2 ${canPrev ? 'bg-slate-900' : 'bg-slate-200'}`}>
        <Text className={`text-sm font-bold ${canPrev ? 'text-white' : 'text-slate-400'}`}>
          ‹ Prev
        </Text>
      </Pressable>
      <View className="items-center">
        {loading ? (
          <ActivityIndicator size="small" color="#10b981" />
        ) : (
          <Text className="text-sm font-bold text-slate-800">
            Page {page} / {totalPages}
          </Text>
        )}
        <Text className="text-[11px] text-slate-500">
          {total} {total === 1 ? noun.replace(/s$/, '') : noun}
        </Text>
      </View>
      <Pressable
        disabled={!canNext}
        onPress={() => onPage(page + 1)}
        className={`rounded-lg px-4 py-2 ${canNext ? 'bg-slate-900' : 'bg-slate-200'}`}>
        <Text className={`text-sm font-bold ${canNext ? 'text-white' : 'text-slate-400'}`}>
          Next ›
        </Text>
      </Pressable>
    </View>
  );
}

// ---- Status badge -----------------------------------------------------------
const BADGE: Record<string, { label: string; cls: string }> = {
  paid: { label: 'PAID', cls: 'bg-emerald-100 text-emerald-700' },
  credit: { label: 'CREDIT', cls: 'bg-red-100 text-red-700' },
  settled: { label: 'SETTLED', cls: 'bg-sky-100 text-sky-700' },
  pending: { label: 'NOT SYNCED', cls: 'bg-amber-100 text-amber-700' },
  error: { label: 'FAILED', cls: 'bg-red-100 text-red-700' },
};

export function StatusBadge({ status }: { status: BillStatus | 'pending' | 'error' }) {
  const b = BADGE[status] ?? BADGE.paid;
  return (
    <Text className={`overflow-hidden rounded-full px-2 py-0.5 text-[10px] font-bold ${b.cls}`}>
      {b.label}
    </Text>
  );
}

// ---- Empty / error / loading placeholder -----------------------------------
export function ListPlaceholder({
  loading,
  error,
  emoji,
  message,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  emoji: string;
  message: string;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }
  return (
    <View className="flex-1 items-center justify-center px-6 py-16">
      <Text className="text-5xl">{error ? '⚠️' : emoji}</Text>
      <Text className="mt-3 text-center text-base text-slate-500">
        {error ? `Couldn't load.\n${error}` : message}
      </Text>
      {error && onRetry && (
        <Pressable
          onPress={onRetry}
          className="mt-4 rounded-xl bg-emerald-500 px-6 py-3 active:opacity-80">
          <Text className="font-bold text-white">Retry</Text>
        </Pressable>
      )}
    </View>
  );
}

// ---- Bottom sheet ------------------------------------------------------------
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const { height: windowHeight } = useWindowDimensions();
  // Sits directly on top of the keyboard when it is open; the body scrolls.
  const maxHeight = Math.max(240, windowHeight - keyboard - insets.top - 16);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View className="flex-1">
        <Pressable onPress={onClose} className="flex-1 bg-black/40" />
        <View
          className="rounded-t-3xl bg-slate-50"
          style={{
            maxHeight,
            marginBottom: keyboard,
            paddingBottom: keyboard > 0 ? 0 : insets.bottom,
          }}>
          <View className="flex-row items-start justify-between border-b border-slate-200 px-5 pb-3 pt-4">
            <View className="flex-1 pr-3">
              <Text className="text-lg font-bold text-slate-900">{title}</Text>
              {subtitle ? <Text className="text-xs text-slate-500">{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={12} className="rounded-full bg-slate-200 px-3 py-1">
              <Text className="text-sm font-bold text-slate-600">✕</Text>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16 }}>
            {children}
          </ScrollView>
          {footer ? (
            <View className="border-t border-slate-200 bg-white px-4 py-3">{footer}</View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

// ---- Label / value row ------------------------------------------------------
export function KV({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'red' | 'green' | 'default';
}) {
  const color =
    tone === 'red' ? 'text-red-600' : tone === 'green' ? 'text-emerald-600' : 'text-slate-900';
  return (
    <View className="flex-row justify-between py-1">
      <Text className="text-sm text-slate-600">{label}</Text>
      <Text className={`text-sm ${strong ? 'font-bold' : ''} ${color}`}>{value}</Text>
    </View>
  );
}
