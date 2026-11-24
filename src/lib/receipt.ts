import type { DisplayBill } from '@/api/types';
import type { PaperWidth } from '@/store/printSettingsStore';

import { RECEIPT_LOGO_DATA_URI } from './receiptLogo';

// ---- Shop details printed in the receipt header ---------------------------
export const SHOP = {
  name: 'ජය සනු',
  tagline: 'බුලත්, පුවක්, බිත්තර සහ සිල්ලර භාණ්ඩ තොග මිලට සපයන්නෝ',
  phone: '071-5805320',
};

const ZWJ = '‍'; // needed for Sinhala "yansaya"/"rakaransaya" conjuncts

const T = {
  billNo: 'බිල් අංකය',
  date: 'දිනය',
  time: 'වේලාව',
  shopName: 'වෙළඳසැලේ නම',
  item: 'අයිතමය',
  qty: `ප්${ZWJ}රමාණය`,
  amount: 'මුදල',
  total: 'එකතුව',
  received: 'ලැබුණු මුදල',
  due: 'හිඟ මුදල',
  change: 'ඉතිරි මුදල',
  method: `ගෙවීම් ක්${ZWJ}රමය`,
  cash: 'Cash / මුදලින්',
  credit: 'Credit / ණයට',
  thanks: 'ස්තූතියි! නැවත පැමිණෙන්න.',
  thanksEn: 'Thank you for your business!',
  offline: 'Offline — not yet synced',
};

// Betel leaf & arecanut drawing (see src/lib/receiptLogo.ts).
const LOGO_IMG = `<img class="logo" src="${RECEIPT_LOGO_DATA_URI}" alt="" />`;

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTime(d: Date): string {
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${pad(h12)}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

// Plain number with thousands separators, e.g. 1,250.00
function num(amount: number): string {
  const fixed = (Math.round(amount * 100) / 100).toFixed(2);
  const [i, dec] = fixed.split('.');
  return `${i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`;
}

function money(amount: number): string {
  return `Rs. ${num(amount)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function billLabel(bill: DisplayBill): string {
  if (bill.billNo == null) return bill.localRef ?? 'OFFLINE';
  const year = new Date(bill.createdAt).getFullYear() || new Date().getFullYear();
  return `INV-${year}-${pad(bill.billNo, 3)}`;
}

// Page geometry per roll width. Printable area is narrower than the roll.
const LAYOUT: Record<
  PaperWidth,
  { paperMm: number; contentMm: number; base: number; logoMm: number }
> = {
  '58': { paperMm: 58, contentMm: 48, base: 8.5, logoMm: 40 },
  '80': { paperMm: 80, contentMm: 72, base: 10.5, logoMm: 52 },
};

// Size of the PDF page in points (1/72 inch), tall enough for every line.
export function receiptPageSize(bill: DisplayBill, width: PaperWidth) {
  const MM_TO_PT = 72 / 25.4;
  const { paperMm } = LAYOUT[width];
  const perItemMm = width === '58' ? 9 : 7;
  const heightMm = 150 + LAYOUT[width].logoMm * 0.5 + bill.items.length * perItemMm;
  return {
    width: Math.round(paperMm * MM_TO_PT),
    height: Math.round(heightMm * MM_TO_PT),
  };
}

export function buildReceiptHtml(bill: DisplayBill, width: PaperWidth = '58'): string {
  const { contentMm, base, logoMm } = LAYOUT[width];
  const created = new Date(bill.createdAt);
  const validDate = !Number.isNaN(created.getTime());

  const rows = bill.items
    .map(
      (line) => `
      <tr>
        <td class="name">${escapeHtml(line.name)}<div class="unit">${num(line.price)} × ${line.qty}</div></td>
        <td class="qty">${line.qty}</td>
        <td class="amt">${num(line.qty * line.price)}</td>
      </tr>`,
    )
    .join('');

  const dots = '............';
  const customer = bill.customerName?.trim()
    ? escapeHtml(bill.customerName.trim())
    : dots;
  const isCredit = bill.amountDue > 0;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: "Noto Sans Sinhala", "Iskoola Pota", "Noto Sans", sans-serif;
    color: #000; font-size: ${base}pt; line-height: 1.35;
    -webkit-print-color-adjust: exact;
  }
  .receipt { width: ${contentMm}mm; margin: 0 auto; padding: 3mm 0 6mm; }
  .mono, td.qty, td.amt, .unit { font-family: "Roboto Mono", "Droid Sans Mono", monospace; font-weight: 600; }
  .center { text-align: center; }
  .logo { width: ${logoMm}mm; height: auto; display: block; margin: 0 auto 3pt; }
  .shop { font-size: ${base * 1.6}pt; font-weight: 800; margin: 0; }
  .tagline { font-size: ${base}pt; margin-top: 2pt; }
  .phone { font-size: ${base * 1.15}pt; font-weight: 700; margin-top: 3pt; letter-spacing: 0.5pt; }
  .dash { border-top: 1px dashed #000; margin: 5pt 0; }
  .solid { border-top: 1px solid #000; margin: 5pt 0; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 6pt; padding: 1pt 0; }
  .row > span:first-child { white-space: nowrap; }
  .row .v { text-align: right; }
  .strong { font-weight: 700; }
  .big { font-size: ${base * 1.15}pt; }
  table { width: 100%; border-collapse: collapse; }
  thead th { font-weight: 700; padding: 3pt 0; text-align: left; }
  th.qty, td.qty { text-align: center; width: 22%; }
  th.amt, td.amt { text-align: right; width: 28%; }
  td { vertical-align: top; padding: 2pt 0; }
  .unit { font-size: ${base * 0.85}pt; font-weight: 400; }
  .duebox { border: 1.5px solid #000; border-radius: 4pt; padding: 3pt 5pt; margin: 4pt 0; }
  .small { font-size: ${base * 0.9}pt; }
  .thanks { font-weight: 700; font-size: ${base * 1.1}pt; }
  .note { font-weight: 700; margin-top: 2pt; }
</style>
</head>
<body>
  <div class="receipt">
    <div class="center">
      ${LOGO_IMG}
      <h1 class="shop">${SHOP.name}</h1>
      <div class="tagline">${SHOP.tagline}</div>
      <div class="phone mono">${SHOP.phone}</div>
      ${bill.billNo == null ? `<div class="small note">${T.offline}</div>` : ''}
    </div>

    <div class="dash"></div>

    <div class="row"><span>${T.billNo} :</span><span class="v mono strong">${billLabel(bill)}</span></div>
    <div class="row"><span>${T.date} :</span><span class="v mono">${validDate ? formatDate(created) : bill.createdAt}</span></div>
    <div class="row"><span>${T.time} :</span><span class="v mono">${validDate ? formatTime(created) : ''}</span></div>

    <div class="solid"></div>
    <div class="row"><span>${T.shopName} :</span><span class="v strong big">${customer}</span></div>
    <div class="solid"></div>

    <table>
      <thead>
        <tr><th>${T.item}</th><th class="qty">${T.qty}</th><th class="amt">${T.amount}</th></tr>
      </thead>
    </table>
    <div class="solid" style="margin-top:0"></div>
    <table><tbody>${rows}</tbody></table>
    <div class="solid"></div>

    <div class="row strong big"><span>${T.total}</span><span class="v mono">${money(bill.total)}</span></div>
    <div class="row"><span>${T.received}</span><span class="v mono">${money(bill.cashReceived)}</span></div>
    <div class="row duebox strong big"><span>${T.due}</span><span class="v mono">${money(bill.amountDue)}</span></div>
    ${
      !isCredit && bill.balance > 0
        ? `<div class="row"><span>${T.change}</span><span class="v mono">${money(bill.balance)}</span></div>`
        : ''
    }
    <div class="row small"><span>${T.method}:</span><span class="v strong">${isCredit ? T.credit : T.cash}</span></div>

    <div class="dash"></div>
    <div class="center">
      <div class="thanks">${T.thanks}</div>
      <div class="small">${T.thanksEn}</div>
    </div>
  </div>
</body>
</html>`;
}
