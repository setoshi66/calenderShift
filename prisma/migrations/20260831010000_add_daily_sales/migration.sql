-- CreateTable
CREATE TABLE "daily_sales" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "cashAmount" INTEGER NOT NULL DEFAULT 0,
    "cardAmount" INTEGER NOT NULL DEFAULT 0,
    "otherAmount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_sales_date_idx" ON "daily_sales"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_sales_storeId_date_key" ON "daily_sales"("storeId", "date");

-- AddForeignKey
ALTER TABLE "daily_sales" ADD CONSTRAINT "daily_sales_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
