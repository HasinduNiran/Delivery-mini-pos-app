import Constants from 'expo-constants';

// App configuration. EXPO_PUBLIC_* vars are embedded in the bundle (see .env).
const RAW_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

// Port the backend listens on (matches server/.env PORT).
const API_PORT = 4000;

// In dev, the device reaches the bundler at some host (LAN IP, emulator alias,
// or localhost on web). The backend runs on that same machine, so we reuse the
// bundler's host instead of a hardcoded one. This makes "localhost" in .env
// work from a real phone automatically.
function deriveHostFromMetro(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    // Fallbacks across Expo Go / dev-client manifest shapes.
    (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } })
      .expoGoConfig?.debuggerHost ??
    (Constants as unknown as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } })
      .manifest2?.extra?.expoClient?.hostUri;

  const host = hostUri?.split(':')[0];
  return host || null;
}

function resolveApiUrl(): string {
  const explicit = RAW_URL.trim().replace(/\/+$/, '');
  const isLocal =
    !explicit || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(explicit);

  // A non-local explicit URL (e.g. a deployed backend) always wins.
  if (explicit && !isLocal) return explicit;

  // Otherwise point at the machine running the bundler.
  const host = deriveHostFromMetro();
  if (host) return `http://${host}:${API_PORT}`;

  return explicit || `http://localhost:${API_PORT}`;
}

export const config = {
  apiUrl: resolveApiUrl(),
  apiKey: API_KEY,
};
