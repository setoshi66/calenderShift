import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, requireWriteAccess } from "@/lib/api-auth";

const updateStoreSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  googleCalendarId: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const store = await prisma.store.findUnique({ where: { id } });
  if (!store) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(store);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireWriteAccess();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const parsed = updateStoreSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const store = await prisma.store.update({ where: { id }, data: parsed.data });
  return Response.json(store);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireWriteAccess();
  if (error) return error;

  const { id } = await params;
  await prisma.store.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
