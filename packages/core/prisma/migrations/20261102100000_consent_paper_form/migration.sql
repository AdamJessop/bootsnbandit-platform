-- Consent form v3 replicates the studio's paper Client Consent Form: the
-- client's address, postcode, phone and email as given on the form, and the
-- artist's half (ID provided, design/placement, the signing artist and their
-- signature). Additive only — every new column is nullable so existing v1/v2
-- forms survive untouched; the v2 idCheckedBy* columns stay.

-- AlterTable
ALTER TABLE "ConsentForm" ADD COLUMN     "address" TEXT,
ADD COLUMN     "artistId" TEXT,
ADD COLUMN     "artistName" TEXT,
ADD COLUMN     "artistSignature" TEXT,
ADD COLUMN     "artistSignedAt" TIMESTAMP(3),
ADD COLUMN     "designPlacement" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "idProvided" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "postcode" TEXT;
