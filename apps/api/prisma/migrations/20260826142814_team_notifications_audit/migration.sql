-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('OWNER', 'BUSINESS_ADMIN', 'INVENTORY_MANAGER', 'SALES_STAFF', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('LOW_STOCK', 'OUT_OF_STOCK', 'NEW_ORDER', 'SUPPLIER_BILL_OVERDUE', 'PAYMENT_DUE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('SENT', 'FAILED');

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "teamRole" "TeamRole" NOT NULL DEFAULT 'SALES_STAFF';

-- CreateTable
CREATE TABLE "audit_log_entries" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_channel_settings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "recipientRoles" "TeamRole"[],

    CONSTRAINT "alert_channel_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_log_entries" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_entries_businessId_createdAt_idx" ON "audit_log_entries"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "alert_channel_settings_businessId_alertType_key" ON "alert_channel_settings"("businessId", "alertType");

-- AddForeignKey
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_channel_settings" ADD CONSTRAINT "alert_channel_settings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_log_entries" ADD CONSTRAINT "notification_log_entries_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
