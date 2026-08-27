/** Shared money formatting. Every business on this platform trades in
 * INR — there's no per-business currency selection yet — so this is a
 * plain, fixed-currency ₹ display. Centralized here so the four places
 * that used to each hardcode their own `$`-prefixed formatter (orders,
 * financials, the dashboard, purchase orders) can't drift out of sync
 * with each other again. */
export function formatCurrency(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}₹${Math.abs(amount).toFixed(2)}`;
}
