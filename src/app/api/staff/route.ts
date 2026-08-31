import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, requireWriteAccess } from "@/lib/api-auth";

const createStaffSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  employmentType: z.string().optional(),
  role: z.enum(["ADMIN", "STORE_MANAGER", "STAFF"]).optional(),
  storeIds: z.array(z.string()).optional(),
});

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const staff = await prisma.staff.findMany({
    orderBy: { name: "asc" },
    include: { storeAssignments: { include: { store: true } } },
  });
  return Response.json(staff);
}

export async function POST(request: Request) {
  const { error } = await requireWriteAccess();
  if (error) return error;

  const body = await request.json();
  const parsed = createStaffSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { storeIds, ...data } = parsed.data;
  const staff = await prisma.staff.create({
    data: {
      ...data,
      storeAssignments: storeIds
        ? { create: storeIds.map((storeId, i) => ({ storeId, isPrimary: i === 0 })) }
        : undefined,
    },
    include: { storeAssignments: true },
  });
  return Response.json(staff, { status: 201 });
}
