// Next.jsのsearchParamsは同名パラメータが複数あると string[]、1つなら string、無ければ undefined になる。
// 常に配列として扱えるように正規化する。
export function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// storeId未指定（URLにパラメータ自体が無い）＝デフォルトで全店舗選択。
// 一方、ユーザーが全チップを解除した状態は「0店舗選択」として区別する必要があるため、
// その場合は目印としてこのセンチネル値を1件だけ付与する。
export const NO_STORE_SELECTED = "__none__";

// URLにstoreIdが無い場合は、ページ遷移・リロードをまたいで選択状態を保てるようcookie
// （storedStoreIds、nullなら未設定）を見る。cookieも無ければ全店舗をデフォルトにする。
export function resolveStoreIds(
  value: string | string[] | undefined,
  storedStoreIds: string[] | null,
  allStoreIds: string[],
): string[] {
  if (value !== undefined) {
    const arr = toArray(value);
    if (arr.length === 1 && arr[0] === NO_STORE_SELECTED) return [];
    return arr;
  }
  if (storedStoreIds !== null) {
    const validIds = new Set(allStoreIds);
    return storedStoreIds.filter((id) => validIds.has(id));
  }
  return allStoreIds;
}

export function appendStoreIdsToParams(q: URLSearchParams, storeIds: string[]): void {
  if (storeIds.length === 0) {
    q.set("storeId", NO_STORE_SELECTED);
  } else {
    storeIds.forEach((id) => q.append("storeId", id));
  }
}
