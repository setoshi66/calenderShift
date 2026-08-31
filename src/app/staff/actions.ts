"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertWriteAccess } from "@/lib/api-auth";

const VALID_ROLES = new Set(["ADMIN", "STORE_MANAGER", "STAFF"]);

export async function createStaff(formData: FormData) {
  await assertWriteAccess();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "STAFF");
  const storeIds = formData.getAll("storeIds").map(String);

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
  await assertWriteAccess();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "STAFF");
  const storeIds = formData.getAll("storeIds").map(String);

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
