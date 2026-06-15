import { useNetInfo } from '@react-native-community/netinfo';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Floating pill shown only while the device is offline. Positioned above the
// tab bar and non-interactive, so it never shifts layout or blocks taps.
export function OfflineBanner() {
  const net = useNetInfo();
  const insets = useSafeAreaInsets();

  const offline =
    net.isConnected === false || net.isInternetReachable === false;
  if (!offline) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + 70,
        alignItems: 'center',
        zIndex: 50,
      }}>
      <View className="flex-row items-center gap-2 rounded-full bg-slate-900 px-4 py-2">
        <View className="h-2 w-2 rounded-full bg-amber-400" />
        <Text className="text-xs font-semibold text-white">
          Offline — sales saved on device
        </Text>
      </View>
    </View>
  );
}
