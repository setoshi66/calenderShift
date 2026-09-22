-- 既存のcardAmountをotherAmountへ合算してから列を削除する
UPDATE "daily_sales" SET "otherAmount" = "otherAmount" + "cardAmount";

-- AlterTable
ALTER TABLE "daily_sales" DROP COLUMN "cardAmount";
