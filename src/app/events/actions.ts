"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertWriteAccess } from "@/lib/api-auth";
import { jstDatetimeLocalToUtc } from "@/lib/date";
import { removeStoreEventFromGoogleCalendar, syncStoreEventToGoogleCalendar } from "@/lib/google-calendar";

export async function createEvent(formData: FormData) {
  const session = await assertWriteAccess();

  const storeId = String(formData.get("storeId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const organizer = String(formData.get("organizer") ?? "").trim() || undefined;
  const startAtRaw = String(formData.get("startAt") ?? "");
  const endAtRaw = String(formData.get("endAt") ?? "");

  if (!storeId || !name || !startAtRaw || !endAtRaw) {
    throw new Error("必須項目が未入力です");
  }

  const startAt = jstDatetimeLocalToUtc(startAtRaw);
  const endAt = jstDatetimeLocalToUtc(endAtRaw);
  if (endAt <= startAt) {
    throw new Error("終了は開始より後の日時にしてください");
  }

  const event = await prisma.storeEvent.create({
    data: { storeId, name, organizer, startAt, endAt, createdById: session.user.id },
  });

  try {
    await syncStoreEventToGoogleCalendar(event.id);
  } catch {
    // 同期失敗はstore_event_calendar_syncsに記録済み
  }

  revalidatePath("/events");
  revalidatePath("/");
}

export async function updateEvent(formData: FormData) {
  await assertWriteAccess();

  const id = String(formData.get("id") ?? "");
  const storeId = String(formData.get("storeId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const organizer = String(formData.get("organizer") ?? "").trim() || null;
  const startAtRaw = String(formData.get("startAt") ?? "");
  const endAtRaw = String(formData.get("endAt") ?? "");

  if (!id || !storeId || !name || !startAtRaw || !endAtRaw) {
    throw new Error("必須項目が未入力です");
  }

  const startAt = jstDatetimeLocalToUtc(startAtRaw);
  const endAt = jstDatetimeLocalToUtc(endAtRaw);
  if (endAt <= startAt) {
    throw new Error("終了は開始より後の日時にしてください");
  }

  await prisma.storeEvent.update({
    where: { id },
    data: { storeId, name, organizer, startAt, endAt },
  });

  try {
    await syncStoreEventToGoogleCalendar(id);
  } catch {
    // 同期失敗はstore_event_calendar_syncsに記録済み
  }

  revalidatePath("/events");
  revalidatePath("/");
}

export async function deleteEvent(formData: FormData) {
  await assertWriteAccess();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("パラメータが不正です");

  try {
    await removeStoreEventFromGoogleCalendar(id);
  } catch {
    // カレンダー側の削除に失敗してもイベント自体の削除は続行する
  }
  await prisma.storeEvent.delete({ where: { id } });

  revalidatePath("/events");
  revalidatePath("/");
}
