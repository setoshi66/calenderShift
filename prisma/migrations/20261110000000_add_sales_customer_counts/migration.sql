-- AlterTable
ALTER TABLE "daily_sales" ADD COLUMN "customerCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "daily_sales" ADD COLUMN "newCustomerCount" INTEGER NOT NULL DEFAULT 0;
