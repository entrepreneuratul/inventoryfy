export interface VelocityRow {
  productId: string;
  name: string;
  businessName: string;
  velocityLabel: string; // "N units/mo"
}

export interface DeadStockRow extends VelocityRow {
  stock: number;
}

export interface TurnoverRow {
  businessId: string;
  name: string;
  ratioLabel: string; // "1.4x"
  trend: 'UP' | 'DOWN' | 'STABLE';
}

export interface ReportsData {
  bestSellers: VelocityRow[];
  deadStock: DeadStockRow[];
  turnover: TurnoverRow[];
}

export type ReportFrequency = 'WEEKLY' | 'MONTHLY';
export type ReportType = 'VELOCITY' | 'TURNOVER' | 'DEAD_STOCK';

export interface ScheduleReportRequest {
  reportType: ReportType;
  frequency: ReportFrequency;
  email: string;
}
