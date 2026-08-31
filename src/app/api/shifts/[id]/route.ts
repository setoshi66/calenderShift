import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, requireWriteAccess } from "@/lib/api-auth";
import { removeShiftFromGoogleCalendar, syncShiftToGoogleCalendar } from "@/lib/google-calendar";

const updateShiftSchema = z.object({
  staffId: z.string().min(1).optional(),
  storeId: z.string().min(1).optional(),
  workDate: z.string().date().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  breakMinutes: z.number().int().min(0).optional(),
  status: z.enum(["DRAFT", "CONFIRMED", "CANCELLED"]).optional(),
  note: z.string().optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const shift = await prisma.shift.findUnique({
    where: { id },
    include: { staff: true, store: true, calendarSync: true },
  });
  if (!shift) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(shift);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireWriteAccess();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const parsed = updateShiftSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { workDate, ...rest } = parsed.data;
  const shift = await prisma.shift.update({
    where: { id },
    data: { ...rest, workDate: workDate ? new Date(workDate) : undefined },
  });

  try {
    if (shift.status === "CONFIRMED") {
      await syncShiftToGoogleCalendar(shift.id);
    } else if (shift.status === "CANCELLED") {
      await removeShiftFromGoogleCalendar(shift.id);
    }
  } catch {
    // 同期失敗はgoogle_calendar_syncsに記録済み。
  }

  return Response.json(shift);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireWriteAccess();
  if (error) return error;

  const { id } = await params;
  try {
    await removeShiftFromGoogleCalendar(id);
  } catch {
    // カレンダー側の削除に失敗してもシフト自体の削除は続行する
  }
  await prisma.shift.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
