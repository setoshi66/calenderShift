"use server";

import { cookies } from "next/headers";
import { COOKIE_NAME, type ViewMode } from "./view-mode";

export async function setViewMode(mode: ViewMode) {
  const store = await cookies();
  store.set(COOKIE_NAME, mode, { path: "/", maxAge: 60 * 60 * 24 * 365 });
}
