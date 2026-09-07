-- AlterTable
ALTER TABLE "Enquiry" ADD COLUMN     "moodboardData" JSONB;

-- CreateTable
CREATE TABLE "MoodboardAsset" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoodboardAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MoodboardAsset_enquiryId_idx" ON "MoodboardAsset"("enquiryId");

-- CreateIndex
CREATE INDEX "MoodboardAsset_createdAt_idx" ON "MoodboardAsset"("createdAt");

-- AddForeignKey
ALTER TABLE "MoodboardAsset" ADD CONSTRAINT "MoodboardAsset_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
