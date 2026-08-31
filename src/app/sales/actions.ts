"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertWriteAccess } from "@/lib/api-auth";

function parseAmount(value: FormDataEntryValue | null): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) throw new Error("金額は0以上の数値で入力してください");
  return Math.round(n);
}

// Excel風グリッドからの一括保存。1店舗・複数日付分をまとめて登録/更新/削除する。
// 各日の金額・メモがすべて空の場合はその日のレコードを削除する。
export async function bulkUpsertSales(formData: FormData) {
  const session = await assertWriteAccess();

  const storeId = String(formData.get("storeId") ?? "");
  if (!storeId) throw new Error("店舗が未選択です");

  const dates = String(formData.get("dates") ?? "")
    .split(",")
    .filter(Boolean);
  if (!dates.length) throw new Error("日付が指定されていません");

  const ops = dates.map((dateStr) => {
    const cashAmount = parseAmount(formData.get(`cash_${dateStr}`));
    const cardAmount = parseAmount(formData.get(`card_${dateStr}`));
    const otherAmount = parseAmount(formData.get(`other_${dateStr}`));
    const note = String(formData.get(`note_${dateStr}`) ?? "").trim() || null;
    const date = new Date(dateStr);
    const isEmpty = cashAmount === 0 && cardAmount === 0 && otherAmount === 0 && !note;

    if (isEmpty) {
      return prisma.dailySales.deleteMany({ where: { storeId, date } });
    }
    return prisma.dailySales.upsert({
      where: { storeId_date: { storeId, date } },
      create: { storeId, date, cashAmount, cardAmount, otherAmount, note, createdById: session.user.id },
      update: { cashAmount, cardAmount, otherAmount, note },
    });
  });

  await prisma.$transaction(ops);

  revalidatePath("/sales");
}

export async function deleteSales(formData: FormData) {
  await assertWriteAccess();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("パラメータが不正です");

  await prisma.dailySales.delete({ where: { id } });

  revalidatePath("/sales");
}
