-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('PAID', 'UNPAID');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "paymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'PAID',
ADD COLUMN     "shippedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "taxRatePercent" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "paidAt" TIMESTAMP(3);
