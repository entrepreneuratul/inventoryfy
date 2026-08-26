export interface LowStockAlertRow {
  productId: string;
  name: string;
  businessName: string;
  stock: number;
  threshold: number;
  status: 'OUT_OF_STOCK' | 'LOW_STOCK';
}

export interface BusinessCard {
  businessId: string;
  name: string;
  type: string | null;
  profitFmt: string;
  revenueFmt: string;
  lowStockCount: number;
  pendingBillsCount: number;
}

export interface ActivityItem {
  icon: 'order' | 'return' | 'po' | 'payment';
  text: string;
  time: string;
}

export interface OwnerDashboard {
  view: 'OWNER';
  totalProfitFmt: string;
  totalRevenueFmt: string;
  totalExpensesFmt: string;
  totalCashFmt: string;
  pendingBillsCount: number;
  businesses: BusinessCard[];
  lowStockAlerts: LowStockAlertRow[];
}

export interface SingleDashboard {
  view: 'SINGLE';
  businessName: string;
  businessType: string | null;
  todaySalesFmt: string;
  cashPositionFmt: string;
  pendingPos: number;
  pendingBills: number;
  lowStockAlerts: LowStockAlertRow[];
  activity: ActivityItem[];
}

export type DashboardData = OwnerDashboard | SingleDashboard;
