"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertWriteAccess } from "@/lib/api-auth";
import { removeShiftFromGoogleCalendar, syncShiftToGoogleCalendar } from "@/lib/google-calendar";

export async function createShift(formData: FormData) {
  const session = await assertWriteAccess();

  const staffId = String(formData.get("staffId") ?? "");
  const storeId = String(formData.get("storeId") ?? "");
  const workDate = String(formData.get("workDate") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const status = String(formData.get("status") ?? "CONFIRMED") as "DRAFT" | "CONFIRMED" | "CANCELLED";
  const breakMinutes = Number(formData.get("breakMinutes") ?? 0) || 0;
  const note = String(formData.get("note") ?? "") || undefined;

  if (!staffId || !storeId || !workDate || !startTime || !endTime) {
    throw new Error("必須項目が未入力です");
  }

  const shift = await prisma.shift.create({
    data: {
      staffId,
      storeId,
      workDate: new Date(workDate),
      startTime,
      endTime,
      status,
      breakMinutes,
      note,
      createdById: session.user.id,
    },
  });

  if (shift.status === "CONFIRMED") {
    try {
      await syncShiftToGoogleCalendar(shift.id);
    } catch {
      // 同期失敗はgoogle_calendar_syncsに記録済み
    }
  }

  revalidatePath("/shifts");
  revalidatePath("/");
}

export async function updateShiftStatus(formData: FormData) {
  await assertWriteAccess();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as "DRAFT" | "CONFIRMED" | "CANCELLED";
  if (!id || !status) throw new Error("パラメータが不正です");

  const shift = await prisma.shift.update({ where: { id }, data: { status } });

  try {
    if (status === "CONFIRMED") {
      await syncShiftToGoogleCalendar(id);
    } else if (status === "CANCELLED") {
      await removeShiftFromGoogleCalendar(id);
    }
  } catch {
    // 同期失敗はgoogle_calendar_syncsに記録済み
  }

  void shift;
  revalidatePath("/shifts");
  revalidatePath("/");
}

export async function deleteShift(formData: FormData) {
  await assertWriteAccess();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("パラメータが不正です");

  try {
    await removeShiftFromGoogleCalendar(id);
  } catch {
    // カレンダー側の削除に失敗してもシフト自体の削除は続行する
  }
  await prisma.shift.delete({ where: { id } });

  revalidatePath("/shifts");
  revalidatePath("/");
}
