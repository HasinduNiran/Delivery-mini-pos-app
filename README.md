# Flowiix POS 👋

An [Expo](https://expo.dev) point-of-sale app with a MongoDB-backed API.
Sell items, deduct stock automatically, save every bill, and print / re-print
receipts.

## Architecture

- **`server/`** — Express + Mongoose API on MongoDB Atlas. Owns products,
  bills, and stock. See [`server/README.md`](server/README.md).
- **`src/`** — the Expo app. Talks to the API, caches the catalog offline
  (AsyncStorage), and prints receipts with `expo-print`.

A mobile app must **not** hold MongoDB credentials, so all DB access goes
through the backend.

## Run it (local dev)

1. **Backend**

   ```bash
   cd server
   npm install
   cp .env.example .env   # set MONGODB_URI + API_KEY
   npm run seed           # one-time: load starter catalog
   npm run dev            # http://localhost:4000
   ```

2. **App** — copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` /
   `EXPO_PUBLIC_API_KEY` (the key must match the server). On a **physical
   phone**, use your computer's LAN IP, e.g. `http://192.168.1.20:4000`, not
   `localhost`.

   ```bash
   npm install
   npx expo start
   ```

## Offline-first

The app keeps working with **no internet**:

- The product catalog is cached on-device (AsyncStorage), so the billing grid
  and stock counts load even when offline.
- Completing a sale tries the server first; if the device is offline (or the
  request fails), the bill is **saved locally** and stock is still deducted, so
  selling never stops. Offline bills get a temporary ref like `OFF-1A2B` and can
  be printed immediately.
- When the connection returns, queued bills **auto-sync** to MongoDB (oldest
  first) and receive their real bill numbers. You can also tap **Sync now** on
  the Bills tab.
- A floating "Offline — sales saved on device" pill shows while disconnected;
  the Bills tab shows a `NOT SYNCED` badge on pending bills and a `FAILED` badge
  if the server rejected one (e.g. a stock conflict from another device), which
  you can then print or remove.

On-screen stock always reflects `server stock − unsynced sales`, so counts stay
correct across refreshes until everything syncs.

## Security notes

- `.env` files are gitignored. **Rotate the MongoDB password** that was shared
  in plain text.
- The `EXPO_PUBLIC_API_KEY` is embedded in the app bundle — it's a basic gate,
  not user auth. Add proper user authentication before a public release.
- Printing: the system print dialog works in Expo Go. Bluetooth **thermal**
  printing is stubbed in [`src/lib/print.ts`](src/lib/print.ts) and needs a
  custom dev build to wire an ESC/POS driver.

---

## Expo template reference

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
