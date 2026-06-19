-- CreateEnum
CREATE TYPE "ArtistStatus" AS ENUM ('CO_OWNER', 'RESIDENT', 'APPRENTICE');

-- DropForeignKey
ALTER TABLE "Artist" DROP CONSTRAINT "Artist_userId_fkey";

-- AlterTable
ALTER TABLE "Artist" DROP COLUMN "hourlyPence",
DROP COLUMN "rateText",
DROP COLUMN "role",
DROP COLUMN "styles",
ADD COLUMN     "hourlyRatePence" INTEGER,
ADD COLUMN     "status" "ArtistStatus" NOT NULL DEFAULT 'RESIDENT',
ALTER COLUMN "userId" SET NOT NULL;

-- CreateTable
CREATE TABLE "_ArtistToTattooStyle" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ArtistToTattooStyle_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ArtistToTattooStyle_B_index" ON "_ArtistToTattooStyle"("B");

-- AddForeignKey
ALTER TABLE "Artist" ADD CONSTRAINT "Artist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArtistToTattooStyle" ADD CONSTRAINT "_ArtistToTattooStyle_A_fkey" FOREIGN KEY ("A") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArtistToTattooStyle" ADD CONSTRAINT "_ArtistToTattooStyle_B_fkey" FOREIGN KEY ("B") REFERENCES "TattooStyle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

