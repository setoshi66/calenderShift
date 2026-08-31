import { cookies } from "next/headers";

const COOKIE_NAME = "storeIds";

// null: 未設定（一度も選択操作をしていない）＝デフォルトで全店舗扱いにする。
// []  : 明示的に0店舗選択。
export async function getStoredStoreIds(): Promise<string[] | null> {
  const store = await cookies();
  const cookie = store.get(COOKIE_NAME);
  if (cookie === undefined) return null;
  if (cookie.value === "") return [];
  return cookie.value.split(",");
}

export { COOKIE_NAME };
