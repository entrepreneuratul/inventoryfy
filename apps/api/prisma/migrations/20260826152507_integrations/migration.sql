-- CreateEnum
CREATE TYPE "IntegrationConnectionStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "IntegrationDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "IntegrationEventType" AS ENUM ('ORDER_RECEIVED', 'INVENTORY_UPDATED');

-- CreateEnum
CREATE TYPE "IntegrationEventStatus" AS ENUM ('SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "externalOrderId" TEXT,
ADD COLUMN     "sourceConnectionId" TEXT;

-- CreateTable
CREATE TABLE "integration_connections" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "IntegrationConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "apiKeyHash" TEXT NOT NULL,
    "apiKeyLastFour" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "webhookSecret" TEXT NOT NULL,
    "defaultWarehouseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_event_logs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "direction" "IntegrationDirection" NOT NULL,
    "eventType" "IntegrationEventType" NOT NULL,
    "status" "IntegrationEventStatus" NOT NULL,
    "payload" JSONB NOT NULL,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_connections_apiKeyHash_key" ON "integration_connections"("apiKeyHash");

-- CreateIndex
CREATE INDEX "integration_event_logs_businessId_createdAt_idx" ON "integration_event_logs"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "orders_sourceConnectionId_externalOrderId_key" ON "orders"("sourceConnectionId", "externalOrderId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_sourceConnectionId_fkey" FOREIGN KEY ("sourceConnectionId") REFERENCES "integration_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_defaultWarehouseId_fkey" FOREIGN KEY ("defaultWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_event_logs" ADD CONSTRAINT "integration_event_logs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_event_logs" ADD CONSTRAINT "integration_event_logs_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

