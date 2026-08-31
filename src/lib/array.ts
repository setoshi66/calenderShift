// Next.jsのsearchParamsは同名パラメータが複数あると string[]、1つなら string、無ければ undefined になる。
// 常に配列として扱えるように正規化する。
export function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
