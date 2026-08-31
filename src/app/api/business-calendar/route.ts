import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, requireWriteAccess } from "@/lib/api-auth";

const upsertSchema = z.object({
  storeId: z.string().min(1),
  date: z.string().date(), // "2026-08-26"
  isOpen: z.boolean(),
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
  note: z.string().optional(),
});

export async function GET(request: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!storeId || !from || !to) {
    return Response.json({ error: "storeId, from, to are required" }, { status: 400 });
  }

  const entries = await prisma.storeBusinessCalendar.findMany({
    where: { storeId, date: { gte: new Date(from), lte: new Date(to) } },
    orderBy: { date: "asc" },
  });
  return Response.json(entries);
}

export async function POST(request: Request) {
  const { error } = await requireWriteAccess();
  if (error) return error;

  const body = await request.json();
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { storeId, date, ...data } = parsed.data;
  const entry = await prisma.storeBusinessCalendar.upsert({
    where: { storeId_date: { storeId, date: new Date(date) } },
    create: { storeId, date: new Date(date), ...data },
    update: data,
  });
  return Response.json(entry, { status: 201 });
}
