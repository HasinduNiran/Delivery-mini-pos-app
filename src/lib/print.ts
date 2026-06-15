import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { DisplayBill } from '@/api/types';

import { buildReceiptHtml } from './receipt';

export type PrintMethod = 'system' | 'thermal';

// ---- System print (expo-print) -------------------------------------------
// Opens the OS print dialog with the rendered receipt. Works in Expo Go and
// on every platform.
export async function printReceiptSystem(bill: DisplayBill): Promise<void> {
  const html = buildReceiptHtml(bill);
  await Print.printAsync({ html });
}

// Generate a PDF of the receipt and open the share sheet (save / send / etc.).
export async function shareReceiptPdf(bill: DisplayBill): Promise<void> {
  const html = buildReceiptHtml(bill);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
  }
}

// ---- Thermal print (Bluetooth ESC/POS) -----------------------------------
// Stub kept behind the same interface so a real driver (e.g.
// react-native-bluetooth-escpos-printer) can be dropped in later. Thermal
// printing needs a custom dev build — it cannot run in Expo Go.
export async function printReceiptThermal(_bill: DisplayBill): Promise<void> {
  throw new Error(
    'Bluetooth thermal printing is not configured yet. Use System print for now. ' +
      'See src/lib/print.ts to wire an ESC/POS driver in a dev build.',
  );
}

// Unified entry point used by the UI.
export async function printReceipt(
  bill: DisplayBill,
  method: PrintMethod = 'system',
): Promise<void> {
  if (method === 'thermal') return printReceiptThermal(bill);
  return printReceiptSystem(bill);
}
