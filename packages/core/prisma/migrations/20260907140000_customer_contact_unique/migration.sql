-- DropIndex
DROP INDEX "Customer_email_idx";

-- DropIndex
DROP INDEX "Customer_phone_idx";

-- CreateIndex
-- Postgres treats NULLs as distinct, so any number of contact-less customers
-- coexist; only real duplicate values are rejected. scripts/merge-duplicate-
-- customers.ts must have been run first or this statement fails.
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");
