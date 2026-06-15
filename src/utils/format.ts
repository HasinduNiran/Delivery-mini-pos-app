// Manual money formatter — avoids relying on Intl, which is only partially
// available under Hermes on some React Native versions.
export function formatMoney(amount: number): string {
  const fixed = (Math.round(amount * 100) / 100).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withSeparators = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `Rs ${withSeparators}.${decPart}`;
}
