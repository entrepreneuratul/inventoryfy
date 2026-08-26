/** Shared money formatting for supplier/PO responses. Multi-currency
 * formatting proper (per-business currency) lands with Financials (Phase 7);
 * this is a simple USD-style display for now. */
export function fmtMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
