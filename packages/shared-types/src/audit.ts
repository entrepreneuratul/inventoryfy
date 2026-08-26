export interface AuditLogRow {
  id: string;
  timestamp: string;
  userName: string;
  /** e.g. "Created", "Updated", "Deleted" */
  action: string;
  /** e.g. "products", "purchase-orders" — the resource the action hit */
  entity: string;
  businessName: string;
}
