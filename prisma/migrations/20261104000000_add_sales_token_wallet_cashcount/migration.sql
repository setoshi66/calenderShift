-- AlterTable
ALTER TABLE "daily_sales" ADD COLUMN "tokenAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "daily_sales" ADD COLUMN "transferWalletAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "daily_sales" ADD COLUMN "purchaseWalletAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "daily_sales" ADD COLUMN "actualCashAmount" INTEGER;
