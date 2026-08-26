import type { TeamRole } from './team';

export type AlertType = 'LOW_STOCK' | 'OUT_OF_STOCK' | 'NEW_ORDER' | 'SUPPLIER_BILL_OVERDUE' | 'PAYMENT_DUE';

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
  NEW_ORDER: 'New order',
  SUPPLIER_BILL_OVERDUE: 'Supplier bill overdue',
  PAYMENT_DUE: 'Payment due',
};

export interface ThresholdRow {
  productId: string;
  name: string;
  stock: number;
  threshold: number;
}

export interface AlertChannelRow {
  alertType: AlertType;
  label: string;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  recipientRoles: TeamRole[];
}

export interface UpdateAlertChannelRequest {
  emailEnabled?: boolean;
  whatsappEnabled?: boolean;
  recipientRoles?: TeamRole[];
}

export type NotificationChannel = 'EMAIL' | 'WHATSAPP';
export type NotificationDeliveryStatus = 'SENT' | 'FAILED';

export interface NotificationHistoryRow {
  id: string;
  date: string;
  type: string;
  channel: NotificationChannel;
  recipient: string;
  status: NotificationDeliveryStatus;
}

export interface SendDigestResult {
  queued: number;
  failed: number;
}
