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

export function resolveStoreIds(value: string | string[] | undefined, allStoreIds: string[]): string[] {
  if (value === undefined) return allStoreIds;
  const arr = toArray(value);
  if (arr.length === 1 && arr[0] === NO_STORE_SELECTED) return [];
  return arr;
}

export function appendStoreIdsToParams(q: URLSearchParams, storeIds: string[]): void {
  if (storeIds.length === 0) {
    q.set("storeId", NO_STORE_SELECTED);
  } else {
    storeIds.forEach((id) => q.append("storeId", id));
  }
}
