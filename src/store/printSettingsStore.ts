import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage } from '@/store/persistStorage';

// Thermal roll width the receipt is laid out for. Saved on the device so the
// choice survives app restarts.
export type PaperWidth = '58' | '80';

type PrintSettingsState = {
  paperWidth: PaperWidth;
  setPaperWidth: (w: PaperWidth) => void;
};

export const usePrintSettingsStore = create<PrintSettingsState>()(
  persist(
    (set) => ({
      paperWidth: '58',
      setPaperWidth: (paperWidth) => set({ paperWidth }),
    }),
    {
      name: 'flowiix-print-settings',
      storage: persistStorage,
    },
  ),
);

// Non-hook accessor for print helpers.
export function getPaperWidth(): PaperWidth {
  return usePrintSettingsStore.getState().paperWidth;
}
