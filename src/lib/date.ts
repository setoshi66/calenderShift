// フォームの日付入力（YYYY-MM-DD）は `new Date(str)` でUTC深夜0時として保存される。
// JSTの「今日」もそれに合わせてUTC深夜0時のDateとして返す必要がある。
export function todayInJst(): Date {
  const dateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  return new Date(dateStr);
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// 任意の日時（フルのDateTime）が属するJST上の暦日を "YYYY-MM-DD" で返す。
export function jstDateKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

export function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export const WEEKDAY_LABEL_JA = ["日", "月", "火", "水", "木", "金", "土"];

// 休憩時間を差し引いた実働時間（時間単位）。日をまたぐシフトにも対応。
export function shiftHours(startTime: string, endTime: string, breakMinutes: number): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;
  minutes -= breakMinutes;
  return Math.max(minutes, 0) / 60;
}

// <input type="datetime-local"> の値（"YYYY-MM-DDTHH:mm"、タイムゾーン情報なし）を
// JSTの壁時計時刻として解釈し、UTC基準のDateに変換する。
// サーバーの実行環境のローカルタイムゾーンに依存させないための変換。
export function jstDatetimeLocalToUtc(datetimeLocal: string): Date {
  const [datePart, timePart] = datetimeLocal.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart ?? "00:00").split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute));
}

// UTC基準のDateを、<input type="datetime-local"> にそのまま渡せるJST表記の文字列に変換する。
export function utcToJstDatetimeLocal(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 16);
}
