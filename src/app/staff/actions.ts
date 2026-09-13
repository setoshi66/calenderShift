"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertWriteAccess } from "@/lib/api-auth";

const VALID_ROLES = new Set(["ADMIN", "STORE_MANAGER", "STAFF"]);

// 時給は管理者のみ設定可能。管理者以外からのリクエストでは項目自体を無視する（undefined＝更新しない）。
function resolveHourlyWage(formData: FormData, isAdmin: boolean): number | null | undefined {
  if (!isAdmin) return undefined;
  const raw = formData.get("hourlyWage");
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error("時給が不正です");
  return Math.round(n);
}

export async function createStaff(formData: FormData) {
  const session = await assertWriteAccess();
  const isAdmin = session.user.role === "ADMIN";

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "STAFF");
  const storeIds = formData.getAll("storeIds").map(String);
  const hourlyWage = resolveHourlyWage(formData, isAdmin);

  if (!name) throw new Error("氏名は必須です");
  if (!VALID_ROLES.has(role)) throw new Error("ロールが不正です");

  try {
    await prisma.staff.create({
      data: {
        name,
        email,
        role: role as "ADMIN" | "STORE_MANAGER" | "STAFF",
        phone: String(formData.get("phone") ?? "") || undefined,
        employmentType: String(formData.get("employmentType") ?? "") || undefined,
        hourlyWage,
        storeAssignments: storeIds.length
          ? { create: storeIds.map((storeId, i) => ({ storeId, isPrimary: i === 0 })) }
          : undefined,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`このメールアドレス（${email}）は既に登録されています`);
    }
    throw e;
  }

  revalidatePath("/staff");
}

export async function updateStaff(formData: FormData) {
  const session = await assertWriteAccess();
  const isAdmin = session.user.role === "ADMIN";

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "STAFF");
  const storeIds = formData.getAll("storeIds").map(String);
  const hourlyWage = resolveHourlyWage(formData, isAdmin);

  if (!id) throw new Error("スタッフIDが不正です");
  if (!name) throw new Error("氏名は必須です");
  if (!VALID_ROLES.has(role)) throw new Error("ロールが不正です");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.staffStoreAssignment.deleteMany({ where: { staffId: id } });
      if (storeIds.length) {
        await tx.staffStoreAssignment.createMany({
          data: storeIds.map((storeId, i) => ({ staffId: id, storeId, isPrimary: i === 0 })),
        });
      }
      await tx.staff.update({
        where: { id },
        data: {
          name,
          email,
          role: role as "ADMIN" | "STORE_MANAGER" | "STAFF",
          phone: String(formData.get("phone") ?? "") || null,
          employmentType: String(formData.get("employmentType") ?? "") || null,
          hourlyWage,
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`このメールアドレス（${email}）は既に登録されています`);
    }
    throw e;
  }

  revalidatePath("/staff");
  redirect("/staff");
}

export async function toggleStaffActive(formData: FormData) {
  await assertWriteAccess();

  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  if (!id) throw new Error("スタッフIDが不正です");

  await prisma.staff.update({ where: { id }, data: { isActive: !isActive } });
  revalidatePath("/staff");
}
