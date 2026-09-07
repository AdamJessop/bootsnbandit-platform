-- CreateEnum
CREATE TYPE "EnquiryChannel" AS ENUM ('web', 'flash', 'inkling', 'email', 'messenger', 'instagram');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('inbound', 'outbound', 'internal');

-- CreateEnum
CREATE TYPE "MessageChannelKind" AS ENUM ('web', 'email', 'messenger', 'instagram', 'note');

-- AlterEnum
-- Postgres 12+ allows ADD VALUE inside a transaction as long as the new value
-- is not USED in the same transaction. Nothing below writes 'customer_replied'.
ALTER TYPE "EnquiryStatus" ADD VALUE 'customer_replied' AFTER 'replied';

-- AlterTable
ALTER TABLE "Enquiry" ADD COLUMN     "channel" "EnquiryChannel" NOT NULL DEFAULT 'web',
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "threadToken" TEXT,
ADD COLUMN     "lastMessageAt" TIMESTAMP(3),
ADD COLUMN     "lastInboundAt" TIMESTAMP(3),
ADD COLUMN     "assignedAt" TIMESTAMP(3);

-- Backfill: every existing enquiry needs a reply token before the NOT NULL.
UPDATE "Enquiry" SET "threadToken" = replace(gen_random_uuid()::text, '-', '') WHERE "threadToken" IS NULL;
ALTER TABLE "Enquiry" ALTER COLUMN "threadToken" SET NOT NULL;

-- Backfill: mirror the legacy source into the new channel column.
UPDATE "Enquiry" SET "channel" = 'flash' WHERE "source" = 'flash';
UPDATE "Enquiry" SET "channel" = 'inkling' WHERE "source" = 'inkling';

-- Backfill: give the inbox a sensible activity ordering from day one.
UPDATE "Enquiry" SET "lastMessageAt" = "createdAt" WHERE "lastMessageAt" IS NULL;
UPDATE "Enquiry" SET "assignedAt" = "updatedAt" WHERE "preferredArtistId" IS NOT NULL AND "assignedAt" IS NULL;

-- CreateTable
CREATE TABLE "EnquiryMessage" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "customerId" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "channel" "MessageChannelKind" NOT NULL,
    "authorUserId" TEXT,
    "fromName" TEXT,
    "fromAddress" TEXT,
    "subject" TEXT,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "externalId" TEXT,
    "deliveryStatus" "MessageStatus" NOT NULL DEFAULT 'logged',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnquiryMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "filename" TEXT,
    "bytes" BYTEA,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnquiryRead" (
    "enquiryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnquiryRead_pkey" PRIMARY KEY ("enquiryId","userId")
);

-- CreateTable
CREATE TABLE "CustomerIdentity" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "channel" "MessageChannelKind" NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Enquiry_threadToken_key" ON "Enquiry"("threadToken");

-- CreateIndex
CREATE INDEX "Enquiry_lastMessageAt_idx" ON "Enquiry"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Enquiry_channel_idx" ON "Enquiry"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "EnquiryMessage_externalId_key" ON "EnquiryMessage"("externalId");

-- CreateIndex
CREATE INDEX "EnquiryMessage_enquiryId_createdAt_idx" ON "EnquiryMessage"("enquiryId", "createdAt");

-- CreateIndex
CREATE INDEX "EnquiryMessage_customerId_idx" ON "EnquiryMessage"("customerId");

-- CreateIndex
CREATE INDEX "Attachment_messageId_idx" ON "Attachment"("messageId");

-- CreateIndex
CREATE INDEX "Attachment_createdAt_idx" ON "Attachment"("createdAt");

-- CreateIndex
CREATE INDEX "EnquiryRead_userId_idx" ON "EnquiryRead"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerIdentity_channel_externalId_key" ON "CustomerIdentity"("channel", "externalId");

-- CreateIndex
CREATE INDEX "CustomerIdentity_customerId_idx" ON "CustomerIdentity"("customerId");

-- AddForeignKey
ALTER TABLE "EnquiryMessage" ADD CONSTRAINT "EnquiryMessage_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryMessage" ADD CONSTRAINT "EnquiryMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryMessage" ADD CONSTRAINT "EnquiryMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "EnquiryMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryRead" ADD CONSTRAINT "EnquiryRead_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryRead" ADD CONSTRAINT "EnquiryRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerIdentity" ADD CONSTRAINT "CustomerIdentity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
