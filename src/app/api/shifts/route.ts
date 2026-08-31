import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, requireWriteAccess } from "@/lib/api-auth";
import { syncShiftToGoogleCalendar } from "@/lib/google-calendar";

const createShiftSchema = z.object({
  staffId: z.string().min(1),
  storeId: z.string().min(1),
  workDate: z.string().date(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  breakMinutes: z.number().int().min(0).optional(),
  status: z.enum(["DRAFT", "CONFIRMED", "CANCELLED"]).optional(),
  note: z.string().optional(),
});

export async function GET(request: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId") ?? undefined;
  const staffId = searchParams.get("staffId") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return Response.json({ error: "from, to are required" }, { status: 400 });
  }

  const shifts = await prisma.shift.findMany({
    where: {
      storeId,
      staffId,
      workDate: { gte: new Date(from), lte: new Date(to) },
    },
    include: { staff: true, store: true, calendarSync: true },
    orderBy: [{ workDate: "asc" }, { startTime: "asc" }],
  });
  return Response.json(shifts);
}

export async function POST(request: Request) {
  const { session, error } = await requireWriteAccess();
  if (error) return error;

  const body = await request.json();
  const parsed = createShiftSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { workDate, ...rest } = parsed.data;
  const shift = await prisma.shift.create({
    data: {
      ...rest,
      workDate: new Date(workDate),
      createdById: session!.user.id,
    },
  });

  if (shift.status === "CONFIRMED") {
    try {
      await syncShiftToGoogleCalendar(shift.id);
    } catch {
      // 同期失敗はgoogle_calendar_syncsに記録済み。シフト自体の登録は成功として扱う。
    }
  }

  return Response.json(shift, { status: 201 });
}
