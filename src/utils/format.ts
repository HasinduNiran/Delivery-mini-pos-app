// Manual money formatter — avoids relying on Intl, which is only partially
// available under Hermes on some React Native versions.
export function formatMoney(amount: number): string {
  const fixed = (Math.round(amount * 100) / 100).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withSeparators = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `Rs ${withSeparators}.${decPart}`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

// 2026-11-24
export function formatDate(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// 02:44 PM
export function formatTime(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  return `${pad2(h % 12 === 0 ? 12 : h % 12)}:${pad2(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

export function formatDateTime(iso: string | Date): string {
  return `${formatDate(iso)}  ${formatTime(iso)}`;
}

// Whole days between a date and now (0 = today).
export function daysAgo(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.max(0, Math.round((start(new Date()) - start(d)) / 86400000));
}
