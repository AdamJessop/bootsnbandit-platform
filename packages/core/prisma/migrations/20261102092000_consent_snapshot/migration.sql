-- Consent forms become a durable licensing record: snapshot what was shown
-- and who checked ID, and stop them vanishing with their booking (Restrict
-- instead of Cascade). Also the hashed front-desk kiosk staff PIN. Additive
-- only — every new column is nullable so existing rows survive untouched.

-- DropForeignKey
ALTER TABLE "ConsentForm" DROP CONSTRAINT "ConsentForm_bookingId_fkey";

-- AlterTable
ALTER TABLE "ConsentForm" ADD COLUMN     "dob" DATE,
ADD COLUMN     "formVersion" INTEGER,
ADD COLUMN     "idCheckedAt" TIMESTAMP(3),
ADD COLUMN     "idCheckedBy" TEXT,
ADD COLUMN     "idCheckedByArtistId" TEXT,
ADD COLUMN     "medicalNotes" TEXT,
ADD COLUMN     "photoConsent" BOOLEAN,
ADD COLUMN     "printedName" TEXT,
ADD COLUMN     "questions" JSONB;

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "kioskPinHash" TEXT;

-- AddForeignKey
ALTER TABLE "ConsentForm" ADD CONSTRAINT "ConsentForm_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
