export type ValuationMethod = 'FIFO' | 'LIFO' | 'WEIGHTED';

export interface ValuationResult {
  method: ValuationMethod;
  amount: number;
  amountFmt: string;
  /** Set when some current stock has no PO-receipt cost history and had
   * to fall back to a supplier's quoted cost (or $0 if none is linked). */
  note: string | null;
}

export interface LandedCost {
  baseFmt: string;
  freightFmt: string;
  dutyFmt: string;
  totalFmt: string;
}

export interface PnlRow {
  businessId: string;
  name: string;
  revenueFmt: string;
  expensesFmt: string;
  profitFmt: string;
  isTotal: boolean;
}

export interface GstRow {
  rate: number;
  taxableFmt: string;
  gstFmt: string;
}

export interface TransactionRow {
  date: string;
  businessName: string;
  type: string;
  note: string;
  amountFmt: string;
  isNegative: boolean;
}

export interface BusinessFinancials {
  apTotalFmt: string;
  arTotalFmt: string;
  pnlRows: PnlRow[];
  gstRows: GstRow[];
  transactions: TransactionRow[];
}
