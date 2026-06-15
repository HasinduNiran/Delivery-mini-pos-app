import { Pressable, Text, View } from 'react-native';

import type { Product } from '@/store/cartStore';
import { formatMoney } from '@/utils/format';

type Props = {
  product: Product;
  onPress: () => void;
};

export function ItemCard({ product, onPress }: Props) {
  const outOfStock = product.stock <= 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={outOfStock}
      className={`m-1 flex-1 rounded-2xl border border-slate-200 bg-white p-4 active:opacity-70 ${
        outOfStock ? 'opacity-50' : ''
      }`}
      style={{ minHeight: 120 }}
    >
      <Text className="mb-2 text-4xl">{product.emoji ?? '🛒'}</Text>
      <Text className="text-sm font-semibold text-slate-800" numberOfLines={1}>
        {product.name}
      </Text>
      <Text className="mt-1 text-base font-bold text-emerald-600">
        {formatMoney(product.price)}
      </Text>
      <View className="mt-1">
        <Text
          className={`text-xs font-semibold ${
            outOfStock ? 'text-red-500' : 'text-slate-400'
          }`}>
          {outOfStock ? 'Out of stock' : `Stock: ${product.stock}`}
        </Text>
      </View>
    </Pressable>
  );
}
