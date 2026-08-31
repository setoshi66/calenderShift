import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, requireWriteAccess } from "@/lib/api-auth";

const createStoreSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  googleCalendarId: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const stores = await prisma.store.findMany({ orderBy: { name: "asc" } });
  return Response.json(stores);
}

export async function POST(request: Request) {
  const { error } = await requireWriteAccess();
  if (error) return error;

  const body = await request.json();
  const parsed = createStoreSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const store = await prisma.store.create({ data: parsed.data });
  return Response.json(store, { status: 201 });
}
