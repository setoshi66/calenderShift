-- CreateTable
CREATE TABLE "payroll_entries" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "extraHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commission1" INTEGER NOT NULL DEFAULT 0,
    "commission2" INTEGER NOT NULL DEFAULT 0,
    "commission3" INTEGER NOT NULL DEFAULT 0,
    "commission4" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_entries_month_idx" ON "payroll_entries"("month");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_entries_staffId_month_key" ON "payroll_entries"("staffId", "month");

-- AddForeignKey
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
