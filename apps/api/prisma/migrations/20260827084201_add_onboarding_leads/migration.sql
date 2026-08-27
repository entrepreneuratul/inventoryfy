-- CreateEnum
CREATE TYPE "OnboardingLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'ONBOARDED', 'DISMISSED');

-- CreateTable
CREATE TABLE "onboarding_leads" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT,
    "status" "OnboardingLeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "onboarding_leads_status_createdAt_idx" ON "onboarding_leads"("status", "createdAt");
