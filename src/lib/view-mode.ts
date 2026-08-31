import { cookies } from "next/headers";

export type ViewMode = "pc" | "sp";

const COOKIE_NAME = "viewMode";

export async function getViewMode(): Promise<ViewMode> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value === "sp" ? "sp" : "pc";
}

export { COOKIE_NAME };
