import { Pressable, Text, View } from 'react-native';

import { type PaperWidth, usePrintSettingsStore } from '@/store/printSettingsStore';

const OPTIONS: PaperWidth[] = ['58', '80'];

// Segmented 58mm / 80mm switch. The choice is saved on the device and used
// for every printed receipt and PDF.
export function PaperSizeToggle({ compact = false }: { compact?: boolean }) {
  const paperWidth = usePrintSettingsStore((s) => s.paperWidth);
  const setPaperWidth = usePrintSettingsStore((s) => s.setPaperWidth);

  return (
    <View className="flex-row items-center">
      {!compact && (
        <Text className="mr-2 text-sm font-medium text-slate-600">Paper</Text>
      )}
      <View className="flex-row rounded-lg bg-slate-200 p-1">
        {OPTIONS.map((w) => {
          const active = paperWidth === w;
          return (
            <Pressable
              key={w}
              onPress={() => setPaperWidth(w)}
              className={`rounded-md px-3 py-1.5 ${active ? 'bg-slate-900' : ''}`}>
              <Text
                className={`text-xs font-bold ${
                  active ? 'text-white' : 'text-slate-600'
                }`}>
                {w}mm
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
