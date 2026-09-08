-- Phase 3: Meta channels.
-- Additive only. MessageChannelKind already has `messenger` and `instagram`,
-- and so does EnquiryChannel (Phase 1, 20260907130000_enquiry_threads), so
-- there is deliberately no ALTER TYPE here — re-adding a value would fail.

-- CreateTable
CREATE TABLE "ChannelConnection" (
    "id" TEXT NOT NULL,
    "channel" "MessageChannelKind" NOT NULL,
    "externalId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "igAccountId" TEXT,
    "name" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "webhookSubscribedAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelConnection_externalId_key" ON "ChannelConnection"("externalId");
CREATE INDEX "ChannelConnection_channel_active_idx" ON "ChannelConnection"("channel", "active");
CREATE INDEX "ChannelConnection_pageId_idx" ON "ChannelConnection"("pageId");

-- AlterTable
ALTER TABLE "EnquiryMessage" ADD COLUMN "senderVerified" BOOLEAN;
ALTER TABLE "EnquiryMessage" ADD COLUMN "connectionId" TEXT;

-- CreateIndex
CREATE INDEX "EnquiryMessage_connectionId_idx" ON "EnquiryMessage"("connectionId");

-- AddForeignKey
ALTER TABLE "EnquiryMessage" ADD CONSTRAINT "EnquiryMessage_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
