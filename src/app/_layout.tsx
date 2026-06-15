import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OfflineBanner } from '@/components/OfflineBanner';
import { startConnectivitySync } from '@/lib/sync';

export default function RootLayout() {
  // Flush queued offline bills on launch and whenever the network returns.
  useEffect(() => {
    const unsubscribe = startConnectivitySync();
    return unsubscribe;
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="bill"
            options={{ presentation: 'modal', title: 'Issue Bill' }}
          />
        </Stack>
        <OfflineBanner />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
