"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/api-auth";

function parseNumber(value: FormDataEntryValue | null): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) throw new Error("数値の形式が不正です");
  return n;
}

// 給与計算のExcel風一括保存。1ヶ月・複数スタッフ分をまとめて登録/更新する。
export async function bulkUpsertPayroll(formData: FormData) {
  await assertAdmin();

  const monthStr = String(formData.get("month") ?? "");
  if (!monthStr) throw new Error("対象月が指定されていません");
  const month = new Date(monthStr);

  const staffIds = String(formData.get("staffIds") ?? "")
    .split(",")
    .filter(Boolean);
  if (!staffIds.length) throw new Error("スタッフが指定されていません");

  const ops = staffIds.map((staffId) => {
    const extraHours = parseNumber(formData.get(`extraHours_${staffId}`));
    const totalHours = parseNumber(formData.get(`totalHours_${staffId}`));
    const commission1 = Math.round(parseNumber(formData.get(`commission1_${staffId}`)));
    const commission2 = Math.round(parseNumber(formData.get(`commission2_${staffId}`)));
    const commission3 = Math.round(parseNumber(formData.get(`commission3_${staffId}`)));
    const commission4 = Math.round(parseNumber(formData.get(`commission4_${staffId}`)));

    return prisma.payrollEntry.upsert({
      where: { staffId_month: { staffId, month } },
      create: { staffId, month, extraHours, totalHours, commission1, commission2, commission3, commission4 },
      update: { extraHours, totalHours, commission1, commission2, commission3, commission4 },
    });
  });

  await prisma.$transaction(ops);

  revalidatePath("/payroll");
}
