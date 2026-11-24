import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { DisplayBill } from '@/api/types';

import { getPaperWidth, type PaperWidth } from '@/store/printSettingsStore';

import { buildReceiptHtml, receiptPageSize } from './receipt';

export type PrintMethod = 'system' | 'thermal';

// ---- System print (expo-print) -------------------------------------------
// Opens the OS print dialog with the rendered receipt. Works in Expo Go and
// on every platform.
// Uses the saved paper width (58mm / 80mm) unless one is passed in.
export async function printReceiptSystem(
  bill: DisplayBill,
  width: PaperWidth = getPaperWidth(),
): Promise<void> {
  const html = buildReceiptHtml(bill, width);
  await Print.printAsync({ html, ...receiptPageSize(bill, width) });
}

// Generate a PDF of the receipt and open the share sheet (save / send / etc.).
export async function shareReceiptPdf(
  bill: DisplayBill,
  width: PaperWidth = getPaperWidth(),
): Promise<void> {
  const html = buildReceiptHtml(bill, width);
  const { uri } = await Print.printToFileAsync({
    html,
    ...receiptPageSize(bill, width),
    margins: { left: 0, right: 0, top: 0, bottom: 0 },
  });
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
