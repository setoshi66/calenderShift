"use server";

import { cookies } from "next/headers";
import { COOKIE_NAME } from "./store-filter";

export async function setStoredStoreIds(storeIds: string[]) {
  const store = await cookies();
  store.set(COOKIE_NAME, storeIds.join(","), { path: "/", maxAge: 60 * 60 * 24 * 365 });
}
