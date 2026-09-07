-- AlterTable
ALTER TABLE "EnquiryMessage" ADD COLUMN     "messageIdHeader" TEXT;

-- CreateTable
CREATE TABLE "WebhookFailure" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "payload" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retriedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookFailure_provider_createdAt_idx" ON "WebhookFailure"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookFailure_externalId_idx" ON "WebhookFailure"("externalId");
