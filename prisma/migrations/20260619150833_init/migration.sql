-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ARTIST', 'OWNER');

-- CreateEnum
CREATE TYPE "BooksStatus" AS ENUM ('open', 'limited', 'closed');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('consult', 'session', 'flash');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('enquiry', 'pending', 'confirmed', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('new', 'replied', 'converted', 'closed');

-- CreateEnum
CREATE TYPE "EnquirySource" AS ENUM ('web', 'flash', 'inkling');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "FlashStatus" AS ENUM ('available', 'claimed', 'retired');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('confirmation', 'reminder', 'receipt', 'aftercare', 'review_request', 'enquiry_ack', 'loyalty_reward');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('email', 'sms');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('queued', 'sent', 'failed', 'logged');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'submitted', 'published', 'hidden');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ARTIST',
    "displayName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Authenticator" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialID" TEXT NOT NULL,
    "credentialPublicKey" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deviceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "Authenticator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "tag" TEXT,
    "bio" TEXT,
    "styles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specials" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hue" TEXT,
    "rateText" TEXT,
    "hourlyPence" INTEGER,
    "dayRatePence" INTEGER,
    "insta" TEXT,
    "headshot" TEXT,
    "experience" TEXT,
    "rating" DOUBLE PRECISION,
    "pieces" INTEGER,
    "booksStatus" "BooksStatus" NOT NULL DEFAULT 'open',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "loyaltyStamps" INTEGER NOT NULL DEFAULT 0,
    "loyaltyTier" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "preferredArtistId" TEXT,
    "style" TEXT,
    "placement" TEXT,
    "size" TEXT,
    "budgetPence" INTEGER,
    "description" TEXT,
    "moodboard" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matchData" JSONB,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'new',
    "source" "EnquirySource" NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "enquiryId" TEXT,
    "chairId" TEXT,
    "type" "BookingType" NOT NULL,
    "style" TEXT,
    "placement" TEXT,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "priceEstimatePence" INTEGER,
    "depositPence" INTEGER,
    "status" "BookingStatus" NOT NULL DEFAULT 'enquiry',
    "notes" TEXT,
    "remindersOptIn" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amountChargedPence" INTEGER NOT NULL,
    "tipPence" INTEGER,
    "bankRef" TEXT,
    "receiptSentAt" TIMESTAMP(3),
    "aftercareSentAt" TIMESTAMP(3),
    "reviewRequestAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leave" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'approved',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Leave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chair" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryItem" (
    "id" TEXT NOT NULL,
    "artistId" TEXT,
    "style" TEXT,
    "title" TEXT NOT NULL,
    "placement" TEXT,
    "image" TEXT,
    "hue" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flash" (
    "id" TEXT NOT NULL,
    "artistId" TEXT,
    "title" TEXT NOT NULL,
    "image" TEXT,
    "hue" TEXT,
    "sizeCm" TEXT,
    "pricePence" INTEGER,
    "total" INTEGER NOT NULL DEFAULT 1,
    "claimed" INTEGER NOT NULL DEFAULT 0,
    "deadline" TEXT,
    "status" "FlashStatus" NOT NULL DEFAULT 'available',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flash_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TattooStyle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TattooStyle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AftercareStage" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "hue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AftercareStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Bandit Pass',
    "stampsPerVisit" INTEGER NOT NULL DEFAULT 1,
    "spendPerStamp" INTEGER,
    "rewardThreshold" INTEGER NOT NULL DEFAULT 8,
    "rewardDesc" TEXT,
    "expiryMonths" INTEGER,
    "perks" JSONB,
    "messaging" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL,
    "studioName" TEXT NOT NULL,
    "addressLine" TEXT,
    "city" TEXT,
    "county" TEXT,
    "postcode" TEXT,
    "hoursText" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "licensingText" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "tickerLines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enquiriesOpen" BOOLEAN NOT NULL DEFAULT true,
    "visualDirection" TEXT NOT NULL DEFAULT 'heritage',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "relatedBookingId" TEXT,
    "type" "MessageType" NOT NULL,
    "channel" "MessageChannel" NOT NULL DEFAULT 'email',
    "subject" TEXT,
    "body" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'logged',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarFeed" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarFeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "customerId" TEXT,
    "token" TEXT NOT NULL,
    "rating" INTEGER,
    "body" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Authenticator_credentialID_key" ON "Authenticator"("credentialID");

-- CreateIndex
CREATE INDEX "Authenticator_userId_idx" ON "Authenticator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_slug_key" ON "Artist"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_userId_key" ON "Artist"("userId");

-- CreateIndex
CREATE INDEX "Artist_booksStatus_idx" ON "Artist"("booksStatus");

-- CreateIndex
CREATE INDEX "Artist_sortOrder_idx" ON "Artist"("sortOrder");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Enquiry_status_idx" ON "Enquiry"("status");

-- CreateIndex
CREATE INDEX "Enquiry_source_idx" ON "Enquiry"("source");

-- CreateIndex
CREATE INDEX "Enquiry_customerId_idx" ON "Enquiry"("customerId");

-- CreateIndex
CREATE INDEX "Enquiry_preferredArtistId_idx" ON "Enquiry"("preferredArtistId");

-- CreateIndex
CREATE INDEX "Booking_artistId_start_idx" ON "Booking"("artistId", "start");

-- CreateIndex
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_start_idx" ON "Booking"("start");

-- CreateIndex
CREATE UNIQUE INDEX "Session_bookingId_key" ON "Session"("bookingId");

-- CreateIndex
CREATE INDEX "AvailabilityRule_artistId_weekday_idx" ON "AvailabilityRule"("artistId", "weekday");

-- CreateIndex
CREATE INDEX "Leave_artistId_startDate_idx" ON "Leave"("artistId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "Chair_name_key" ON "Chair"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GalleryItem_title_key" ON "GalleryItem"("title");

-- CreateIndex
CREATE INDEX "GalleryItem_artistId_idx" ON "GalleryItem"("artistId");

-- CreateIndex
CREATE INDEX "GalleryItem_style_idx" ON "GalleryItem"("style");

-- CreateIndex
CREATE INDEX "GalleryItem_sortOrder_idx" ON "GalleryItem"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Flash_title_key" ON "Flash"("title");

-- CreateIndex
CREATE INDEX "Flash_artistId_idx" ON "Flash"("artistId");

-- CreateIndex
CREATE INDEX "Flash_status_idx" ON "Flash"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TattooStyle_name_key" ON "TattooStyle"("name");

-- CreateIndex
CREATE INDEX "TattooStyle_sortOrder_idx" ON "TattooStyle"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AftercareStage_order_key" ON "AftercareStage"("order");

-- CreateIndex
CREATE INDEX "AftercareStage_order_idx" ON "AftercareStage"("order");

-- CreateIndex
CREATE UNIQUE INDEX "Faq_question_key" ON "Faq"("question");

-- CreateIndex
CREATE INDEX "Faq_sortOrder_idx" ON "Faq"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyConfig_name_key" ON "LoyaltyConfig"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SiteSettings_studioName_key" ON "SiteSettings"("studioName");

-- CreateIndex
CREATE INDEX "MessageLog_customerId_idx" ON "MessageLog"("customerId");

-- CreateIndex
CREATE INDEX "MessageLog_type_idx" ON "MessageLog"("type");

-- CreateIndex
CREATE INDEX "MessageLog_relatedBookingId_idx" ON "MessageLog"("relatedBookingId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarFeed_artistId_key" ON "CalendarFeed"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarFeed_token_key" ON "CalendarFeed"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Review_token_key" ON "Review"("token");

-- CreateIndex
CREATE INDEX "Review_status_idx" ON "Review"("status");

-- CreateIndex
CREATE INDEX "Review_bookingId_idx" ON "Review"("bookingId");

-- AddForeignKey
ALTER TABLE "Authenticator" ADD CONSTRAINT "Authenticator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artist" ADD CONSTRAINT "Artist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_preferredArtistId_fkey" FOREIGN KEY ("preferredArtistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "Chair"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leave" ADD CONSTRAINT "Leave_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryItem" ADD CONSTRAINT "GalleryItem_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flash" ADD CONSTRAINT "Flash_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_relatedBookingId_fkey" FOREIGN KEY ("relatedBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarFeed" ADD CONSTRAINT "CalendarFeed_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
