import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, requireWriteAccess } from "@/lib/api-auth";

const createStaffSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  employmentType: z.string().optional(),
  hourlyWage: z.number().int().nonnegative().optional(),
  role: z.enum(["ADMIN", "STORE_MANAGER", "STAFF"]).optional(),
  storeIds: z.array(z.string()).optional(),
});

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const staff = await prisma.staff.findMany({
    orderBy: { name: "asc" },
    include: { storeAssignments: { include: { store: true } } },
  });
  const isAdmin = session.user.role === "ADMIN";
  const result = isAdmin ? staff : staff.map(({ hourlyWage, ...rest }) => rest);
  return Response.json(result);
}

export async function POST(request: Request) {
  const { session, error } = await requireWriteAccess();
  if (error) return error;

  const body = await request.json();
  const parsed = createStaffSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { storeIds, hourlyWage, ...data } = parsed.data;
  const isAdmin = session.user.role === "ADMIN";
  const staff = await prisma.staff.create({
    data: {
      ...data,
      hourlyWage: isAdmin ? hourlyWage : undefined,
      storeAssignments: storeIds
        ? { create: storeIds.map((storeId, i) => ({ storeId, isPrimary: i === 0 })) }
        : undefined,
    },
    include: { storeAssignments: true },
  });
  return Response.json(staff, { status: 201 });
}
