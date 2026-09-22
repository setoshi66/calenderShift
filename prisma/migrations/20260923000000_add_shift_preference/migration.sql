-- CreateEnum
CREATE TYPE "PreferenceStatus" AS ENUM ('OK', 'MAYBE', 'NG');

-- CreateTable
CREATE TABLE "shift_preferences" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "PreferenceStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shift_preferences_date_idx" ON "shift_preferences"("date");

-- CreateIndex
CREATE UNIQUE INDEX "shift_preferences_staffId_date_key" ON "shift_preferences"("staffId", "date");

-- AddForeignKey
ALTER TABLE "shift_preferences" ADD CONSTRAINT "shift_preferences_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
