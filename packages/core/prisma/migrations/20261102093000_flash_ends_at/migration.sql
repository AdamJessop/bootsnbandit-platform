-- Flash drops get a real closing time. The free-text "deadline" column only
-- ever held stale demo labels ("Sat 7 Jun"), so it is dropped rather than
-- parsed: every existing row starts with endsAt NULL (no closing date) and the
-- owner sets real dates in Content › Flash.

-- AlterTable
ALTER TABLE "Flash" DROP COLUMN "deadline",
ADD COLUMN     "endsAt" TIMESTAMP(3);
