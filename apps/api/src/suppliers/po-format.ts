import { formatCurrency } from '../common/currency';

/** Shared money formatting for supplier/PO responses — see
 * ../common/currency for the ₹ formatting itself. */
export function fmtMoney(amount: number): string {
  return formatCurrency(amount);
}
