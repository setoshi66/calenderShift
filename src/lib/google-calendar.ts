import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

function getCalendarClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  return google.calendar({ version: "v3", auth });
}

function toDateTime(workDate: Date, time: string, timezone: string) {
  const [hour, minute] = time.split(":").map(Number);
  const d = new Date(workDate);
  d.setUTCHours(hour, minute, 0, 0);
  return { dateTime: d.toISOString(), timeZone: timezone };
}

// 確定シフトを店舗の共有Googleカレンダーへ反映する（片方向: システム → Google）
export async function syncShiftToGoogleCalendar(shiftId: string) {
  const shift = await prisma.shift.findUniqueOrThrow({
    where: { id: shiftId },
    include: { staff: true, store: true, calendarSync: true },
  });

  if (!shift.store.googleCalendarId) {
    return; // カレンダー未設定の店舗は同期しない
  }

  const calendar = getCalendarClient();
  const event = {
    summary: `${shift.staff.name}（${shift.store.name}）`,
    description: shift.note ?? undefined,
    start: toDateTime(shift.workDate, shift.startTime, shift.store.timezone),
    end: toDateTime(shift.workDate, shift.endTime, shift.store.timezone),
  };

  try {
    let googleEventId = shift.calendarSync?.googleEventId ?? null;

    if (googleEventId) {
      await calendar.events.update({
        calendarId: shift.store.googleCalendarId,
        eventId: googleEventId,
        requestBody: event,
      });
    } else {
      const res = await calendar.events.insert({
        calendarId: shift.store.googleCalendarId,
        requestBody: event,
      });
      googleEventId = res.data.id ?? null;
    }

    await prisma.googleCalendarSync.upsert({
      where: { shiftId },
      create: {
        shiftId,
        googleEventId,
        syncStatus: "SUCCESS",
        syncedAt: new Date(),
      },
      update: {
        googleEventId,
        syncStatus: "SUCCESS",
        syncedAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (error) {
    await prisma.googleCalendarSync.upsert({
      where: { shiftId },
      create: {
        shiftId,
        syncStatus: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      update: {
        syncStatus: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

// シフトのキャンセル・削除時にGoogleカレンダー側のイベントも削除する
export async function removeShiftFromGoogleCalendar(shiftId: string) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { store: true, calendarSync: true },
  });

  if (!shift?.calendarSync?.googleEventId || !shift.store.googleCalendarId) {
    return;
  }

  const calendar = getCalendarClient();
  await calendar.events.delete({
    calendarId: shift.store.googleCalendarId,
    eventId: shift.calendarSync.googleEventId,
  });

  await prisma.googleCalendarSync.delete({ where: { shiftId } });
}

// 店舗イベントを店舗の共有Googleカレンダーへ反映する（片方向: システム → Google）
export async function syncStoreEventToGoogleCalendar(storeEventId: string) {
  const storeEvent = await prisma.storeEvent.findUniqueOrThrow({
    where: { id: storeEventId },
    include: { store: true, calendarSync: true },
  });

  if (!storeEvent.store.googleCalendarId) {
    return; // カレンダー未設定の店舗は同期しない
  }

  const calendar = getCalendarClient();
  const event = {
    summary: storeEvent.name,
    description: storeEvent.organizer ? `主催: ${storeEvent.organizer}` : undefined,
    start: { dateTime: storeEvent.startAt.toISOString(), timeZone: storeEvent.store.timezone },
    end: { dateTime: storeEvent.endAt.toISOString(), timeZone: storeEvent.store.timezone },
  };

  try {
    let googleEventId = storeEvent.calendarSync?.googleEventId ?? null;

    if (googleEventId) {
      await calendar.events.update({
        calendarId: storeEvent.store.googleCalendarId,
        eventId: googleEventId,
        requestBody: event,
      });
    } else {
      const res = await calendar.events.insert({
        calendarId: storeEvent.store.googleCalendarId,
        requestBody: event,
      });
      googleEventId = res.data.id ?? null;
    }

    await prisma.storeEventCalendarSync.upsert({
      where: { storeEventId },
      create: {
        storeEventId,
        googleEventId,
        syncStatus: "SUCCESS",
        syncedAt: new Date(),
      },
      update: {
        googleEventId,
        syncStatus: "SUCCESS",
        syncedAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (error) {
    await prisma.storeEventCalendarSync.upsert({
      where: { storeEventId },
      create: {
        storeEventId,
        syncStatus: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      update: {
        syncStatus: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

// 店舗イベントの削除時にGoogleカレンダー側のイベントも削除する
export async function removeStoreEventFromGoogleCalendar(storeEventId: string) {
  const storeEvent = await prisma.storeEvent.findUnique({
    where: { id: storeEventId },
    include: { store: true, calendarSync: true },
  });

  if (!storeEvent?.calendarSync?.googleEventId || !storeEvent.store.googleCalendarId) {
    return;
  }

  const calendar = getCalendarClient();
  await calendar.events.delete({
    calendarId: storeEvent.store.googleCalendarId,
    eventId: storeEvent.calendarSync.googleEventId,
  });

  await prisma.storeEventCalendarSync.delete({ where: { storeEventId } });
}
