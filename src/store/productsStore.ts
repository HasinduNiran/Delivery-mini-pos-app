import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  createProduct,
  deleteProduct,
  listProducts,
  type ProductInput,
} from '@/api/products';
import type { Product } from '@/store/cartStore';
import {
  pendingDeductions,
  useOfflineBillsStore,
} from '@/store/offlineBillsStore';
import { persistStorage } from '@/store/persistStorage';

type ProductsState = {
  products: Product[];
  loading: boolean;
  error: string | null;
  hydrated: boolean; // AsyncStorage cache restored
  loadProducts: () => Promise<void>;
  addProduct: (data: ProductInput) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
  // Optimistically apply stock changes after a completed sale.
  applyStockAfterBill: (sold: { productId: string; qty: number }[]) => void;
};

// Catalog can exceed one page; pull a few pages so the billing grid is
// complete. A real shop with thousands of SKUs would switch to on-screen
// search instead, which the API already supports.
async function fetchAllProducts(): Promise<Product[]> {
  const limit = 100;
  const first = await listProducts({ page: 1, limit });
  let all = first.data;
  const totalPages = Math.min(first.pagination.totalPages, 10); // safety cap
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await listProducts({ page, limit });
    all = all.concat(next.data);
  }
  return all;
}

export const useProductsStore = create<ProductsState>()(
  persist(
    (set, get) => ({
      products: [],
      loading: false,
      error: null,
      hydrated: false,

      loadProducts: async () => {
        set({ loading: true, error: null });
        try {
          const products = await fetchAllProducts();
          set({ products, loading: false });
          // Offset authoritative server stock by sales that haven't synced
          // yet, so offline sales stay reflected after a refresh.
          const queue = useOfflineBillsStore.getState().queue;
          if (queue.length > 0) {
            get().applyStockAfterBill(pendingDeductions(queue));
          }
        } catch (err) {
          // Keep showing the cached catalog when offline.
          set({
            loading: false,
            error: (err as Error).message || 'Failed to load products',
          });
        }
      },

      addProduct: async (data) => {
        const created = await createProduct(data);
        set((state) => ({ products: [created, ...state.products] }));
      },

      removeProduct: async (id) => {
        const prev = get().products;
        // Optimistic removal; roll back if the request fails.
        set({ products: prev.filter((p) => p.id !== id) });
        try {
          await deleteProduct(id);
        } catch (err) {
          set({ products: prev });
          throw err;
        }
      },

      applyStockAfterBill: (sold) =>
        set((state) => {
          const soldById = new Map(sold.map((s) => [s.productId, s.qty]));
          return {
            products: state.products.map((p) => {
              const qty = soldById.get(p.id);
              if (!qty) return p;
              return { ...p, stock: Math.max(0, p.stock - qty) };
            }),
          };
        }),
    }),
    {
      name: 'flowiix-products-cache',
      storage: persistStorage,
      partialize: (state) => ({ products: state.products }),
      // Flip `hydrated` once the cached catalog has been restored so screens
      // can distinguish "still loading cache" from "cache is empty".
      onRehydrateStorage: () => () => {
        useProductsStore.setState({ hydrated: true });
      },
    },
  ),
);
