export function preferenceLabel(status: string | undefined | null): string {
  if (status === "OK") return "○";
  if (status === "MAYBE") return "△";
  if (status === "NG") return "✕";
  return "";
}
