-- CreateTable
CREATE TABLE "store_events" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizer" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_event_calendar_syncs" (
    "id" TEXT NOT NULL,
    "storeEventId" TEXT NOT NULL,
    "googleEventId" TEXT,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_event_calendar_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_events_storeId_startAt_idx" ON "store_events"("storeId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "store_event_calendar_syncs_storeEventId_key" ON "store_event_calendar_syncs"("storeEventId");

-- AddForeignKey
ALTER TABLE "store_events" ADD CONSTRAINT "store_events_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_event_calendar_syncs" ADD CONSTRAINT "store_event_calendar_syncs_storeEventId_fkey" FOREIGN KEY ("storeEventId") REFERENCES "store_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
