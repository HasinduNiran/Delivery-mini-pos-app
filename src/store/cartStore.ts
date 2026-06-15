import { create } from 'zustand';

export type Product = {
  id: string;
  name: string;
  price: number; // retail / selling price
  costPrice: number; // purchase cost (GRN)
  stock: number; // quantity on hand
  emoji?: string;
};

export type CartLine = {
  product: Product;
  qty: number;
};

type CartState = {
  items: Record<string, CartLine>;
  addItem: (product: Product, qty?: number) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
};

export const useCartStore = create<CartState>((set) => ({
  items: {},

  addItem: (product, qty = 1) =>
    set((state) => {
      const nextQty = (state.items[product.id]?.qty ?? 0) + qty;
      if (nextQty <= 0) {
        const { [product.id]: _removed, ...rest } = state.items;
        return { items: rest };
      }
      return {
        items: { ...state.items, [product.id]: { product, qty: nextQty } },
      };
    }),

  removeItem: (id) =>
    set((state) => {
      const { [id]: _removed, ...rest } = state.items;
      return { items: rest };
    }),

  updateQty: (id, qty) =>
    set((state) => {
      const existing = state.items[id];
      if (!existing) return state;
      if (qty <= 0) {
        const { [id]: _removed, ...rest } = state.items;
        return { items: rest };
      }
      return { items: { ...state.items, [id]: { ...existing, qty } } };
    }),

  clearCart: () => set({ items: {} }),
}));

// Derived selectors — return primitives so they are safe to use directly
// with the store hook (no extra equality function needed).
export const selectTotalCount = (state: CartState) =>
  Object.values(state.items).reduce((sum, line) => sum + line.qty, 0);

export const selectTotalAmount = (state: CartState) =>
  Object.values(state.items).reduce(
    (sum, line) => sum + line.qty * line.product.price,
    0,
  );
