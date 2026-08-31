import { auth } from "@/lib/auth";

const WRITE_ROLES = new Set(["ADMIN", "STORE_MANAGER"]);

// Server Actionsから使う版。権限がなければthrowする。
export async function assertWriteAccess() {
  const session = await auth();
  if (!session?.user || !WRITE_ROLES.has(session.user.role)) {
    throw new Error("この操作を行う権限がありません");
  }
  return session;
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    return { session: null, error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, error: null };
}

export async function requireWriteAccess() {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };
  if (!WRITE_ROLES.has(session!.user.role)) {
    return { session: null, error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, error: null };
}
