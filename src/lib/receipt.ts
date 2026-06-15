import type { DisplayBill } from '@/api/types';
import { formatMoney } from '@/utils/format';

const STORE_NAME = 'Flowiix Store';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 80mm-width receipt HTML, suitable for expo-print's system dialog and for
// PDFs. Width is set narrow so it also previews like a real receipt roll.
export function buildReceiptHtml(bill: DisplayBill): string {
  const billLabel =
    bill.billNo != null ? `#${bill.billNo}` : bill.localRef ?? '(offline)';
  const pendingNote =
    bill.billNo == null
      ? '<div class="muted" style="margin-top:2px">Offline — not yet synced</div>'
      : '';
  const rows = bill.items
    .map((line) => {
      const name = `${line.emoji ? `${line.emoji} ` : ''}${escapeHtml(
        line.name,
      )}`;
      return `
        <tr>
          <td class="name">${name}</td>
          <td class="qty">${line.qty}</td>
          <td class="amt">${formatMoney(line.qty * line.price)}</td>
        </tr>
        <tr class="sub"><td colspan="3">${line.qty} × ${formatMoney(
          line.price,
        )}</td></tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color:#111; margin:0; padding:16px; }
  .receipt { width:300px; margin:0 auto; }
  .center { text-align:center; }
  h1 { font-size:18px; margin:0 0 2px; }
  .muted { color:#666; font-size:11px; }
  .meta { font-size:12px; margin:10px 0; }
  .meta div { display:flex; justify-content:space-between; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  thead th { text-align:left; border-bottom:1px solid #000; padding:4px 0; font-size:11px; }
  th.qty, td.qty { text-align:center; width:34px; }
  th.amt, td.amt { text-align:right; width:80px; }
  td.name { padding-top:4px; }
  tr.sub td { color:#777; font-size:10px; padding-bottom:4px; }
  .totals { margin-top:8px; border-top:1px dashed #000; padding-top:8px; font-size:13px; }
  .totals div { display:flex; justify-content:space-between; padding:2px 0; }
  .grand { font-size:16px; font-weight:700; border-top:1px solid #000; margin-top:4px; padding-top:6px; }
  .foot { text-align:center; margin-top:14px; font-size:11px; color:#666; }
  .dashed { border-top:1px dashed #000; margin:8px 0; }
</style>
</head>
<body>
  <div class="receipt">
    <div class="center">
      <h1>${STORE_NAME}</h1>
      <div class="muted">Sales Receipt</div>
      ${pendingNote}
    </div>

    <div class="meta">
      <div><span>Bill No</span><span>${billLabel}</span></div>
      <div><span>Date</span><span>${formatDate(bill.createdAt)}</span></div>
      <div><span>Items</span><span>${bill.itemCount}</span></div>
      ${
        bill.customerName
          ? `<div><span>Customer</span><span>${escapeHtml(
              bill.customerName,
            )}</span></div>`
          : ''
      }
    </div>

    <table>
      <thead>
        <tr><th>Item</th><th class="qty">Qty</th><th class="amt">Amount</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div class="grand"><span>Total</span><span>${formatMoney(
        bill.total,
      )}</span></div>
      <div><span>Cash</span><span>${formatMoney(bill.cashReceived)}</span></div>
      ${
        bill.amountDue > 0
          ? `<div style="font-weight:700"><span>Balance Due</span><span>${formatMoney(
              bill.amountDue,
            )}</span></div>`
          : `<div><span>Change</span><span>${formatMoney(
              bill.balance,
            )}</span></div>`
      }
    </div>
    ${
      bill.amountDue > 0
        ? '<div class="foot" style="color:#b91c1c;font-weight:700;margin-top:8px">** CREDIT — BALANCE DUE **</div>'
        : ''
    }

    <div class="foot">
      Thank you for your purchase!<br/>
      Powered by Flowiix POS
    </div>
  </div>
</body>
</html>`;
}
