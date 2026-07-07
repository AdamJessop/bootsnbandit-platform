-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'welcome';

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_chairId_fkey";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "chairId",
ADD COLUMN     "cancelRequestedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "passwordHash" TEXT;

-- DropTable
DROP TABLE "Chair";

-- CreateTable
CREATE TABLE "CustomerPasswordToken" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPasswordToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPasswordToken_token_key" ON "CustomerPasswordToken"("token");

-- CreateIndex
CREATE INDEX "CustomerPasswordToken_customerId_idx" ON "CustomerPasswordToken"("customerId");

-- AddForeignKey
ALTER TABLE "CustomerPasswordToken" ADD CONSTRAINT "CustomerPasswordToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

