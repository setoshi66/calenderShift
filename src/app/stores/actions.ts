"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertWriteAccess } from "@/lib/api-auth";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export async function createStore(formData: FormData) {
  await assertWriteAccess();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("店舗名は必須です");

  const color = String(formData.get("color") ?? "").trim();
  if (color && !HEX_COLOR_RE.test(color)) throw new Error("識別色の形式が不正です");

  await prisma.store.create({
    data: {
      name,
      address: String(formData.get("address") ?? "") || undefined,
      phone: String(formData.get("phone") ?? "") || undefined,
      timezone: String(formData.get("timezone") ?? "") || undefined,
      googleCalendarId: String(formData.get("googleCalendarId") ?? "") || undefined,
      color: color || undefined,
    },
  });

  revalidatePath("/stores");
  revalidatePath("/");
  revalidatePath("/shifts");
}

export async function updateStore(formData: FormData) {
  await assertWriteAccess();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id) throw new Error("店舗IDが不正です");
  if (!name) throw new Error("店舗名は必須です");

  const color = String(formData.get("color") ?? "").trim();
  if (color && !HEX_COLOR_RE.test(color)) throw new Error("識別色の形式が不正です");

  await prisma.store.update({
    where: { id },
    data: {
      name,
      address: String(formData.get("address") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      timezone: String(formData.get("timezone") ?? "") || undefined,
      googleCalendarId: String(formData.get("googleCalendarId") ?? "") || null,
      color: color || undefined,
    },
  });

  revalidatePath("/stores");
  revalidatePath("/");
  revalidatePath("/shifts");
  redirect("/stores");
}

export async function toggleStoreActive(formData: FormData) {
  await assertWriteAccess();

  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  if (!id) throw new Error("店舗IDが不正です");

  await prisma.store.update({ where: { id }, data: { isActive: !isActive } });
  revalidatePath("/stores");
}
