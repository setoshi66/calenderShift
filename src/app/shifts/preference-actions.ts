"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// シフト希望はロールに関わらずログインしていれば誰でも編集可能。
export async function upsertShiftPreference(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("ログインが必要です");

  const staffId = String(formData.get("staffId") ?? "");
  const date = String(formData.get("date") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!staffId || !date) throw new Error("パラメータが不正です");

  if (!status) {
    await prisma.shiftPreference.deleteMany({ where: { staffId, date: new Date(date) } });
  } else {
    if (status !== "OK" && status !== "MAYBE" && status !== "NG") {
      throw new Error("パラメータが不正です");
    }
    await prisma.shiftPreference.upsert({
      where: { staffId_date: { staffId, date: new Date(date) } },
      create: { staffId, date: new Date(date), status },
      update: { status },
    });
  }

  revalidatePath("/shifts");
  revalidatePath("/");
}
