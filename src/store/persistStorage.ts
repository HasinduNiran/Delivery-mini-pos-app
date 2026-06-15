import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

// During Expo's web static prerender there is no `window`, and AsyncStorage's
// web backend throws when it touches `window.localStorage`. React Native (and
// the browser) always define `window`, so this guard disables persistence only
// during server-side prerendering and uses AsyncStorage everywhere else.
const noopStorage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
};

export const persistStorage = createJSONStorage(() =>
  typeof window === 'undefined' ? noopStorage : AsyncStorage,
);
