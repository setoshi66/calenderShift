import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, requireWriteAccess } from "@/lib/api-auth";

const updateStaffSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  employmentType: z.string().optional(),
  role: z.enum(["ADMIN", "STORE_MANAGER", "STAFF"]).optional(),
  isActive: z.boolean().optional(),
  storeIds: z.array(z.string()).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const staff = await prisma.staff.findUnique({
    where: { id },
    include: { storeAssignments: { include: { store: true } } },
  });
  if (!staff) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(staff);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireWriteAccess();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const parsed = updateStaffSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { storeIds, ...data } = parsed.data;

  const staff = await prisma.$transaction(async (tx) => {
    if (storeIds) {
      await tx.staffStoreAssignment.deleteMany({ where: { staffId: id } });
      await tx.staffStoreAssignment.createMany({
        data: storeIds.map((storeId, i) => ({ staffId: id, storeId, isPrimary: i === 0 })),
      });
    }
    return tx.staff.update({
      where: { id },
      data,
      include: { storeAssignments: { include: { store: true } } },
    });
  });

  return Response.json(staff);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireWriteAccess();
  if (error) return error;

  const { id } = await params;
  // 物理削除ではなく無効化のみ行う（過去シフトの参照整合性を保つため）
  const staff = await prisma.staff.update({ where: { id }, data: { isActive: false } });
  return Response.json(staff);
}
