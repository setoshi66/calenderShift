import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { StoreFilterChips } from "@/components/store-filter-chips";
import { thStyle, tdStyle } from "@/lib/table-styles";
import { addDays, formatDate, jstDateKey, todayInJst, WEEKDAY_LABEL_JA } from "@/lib/date";
import { toArray } from "@/lib/array";
import { bulkUpsertSales, deleteSales } from "./actions";

function yen(n: number) {
  return `¥${n.toLocaleString("ja-JP")}`;
}

function monthLink(year: number, month: number, storeIds: string[]) {
  const q = new URLSearchParams({ year: String(year), month: String(month) });
  storeIds.forEach((id) => q.append("storeId", id));
  return `/sales?${q.toString()}`;
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string | string[]; year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const canWrite = session?.user.role === "ADMIN" || session?.user.role === "STORE_MANAGER";
  const today = todayInJst();

  const year = Number(params.year) || today.getUTCFullYear();
  const month = Number(params.month) || today.getUTCMonth() + 1; // 1-12
  const storeIds = toArray(params.storeId);
  const showStoreName = storeIds.length !== 1;

  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const lastOfMonth = new Date(Date.UTC(year, month, 0));

  const singleStoreId = storeIds.length === 1 ? storeIds[0] : undefined;

  const [sales, stores, gridShifts, gridEvents] = await Promise.all([
    prisma.dailySales.findMany({
      where: {
        storeId: storeIds.length ? { in: storeIds } : undefined,
        date: { gte: firstOfMonth, lte: lastOfMonth },
      },
      include: { store: true },
      orderBy: [{ date: "asc" }, { storeId: "asc" }],
    }),
    prisma.store.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    singleStoreId
      ? prisma.shift.findMany({
          where: { storeId: singleStoreId, workDate: { gte: firstOfMonth, lte: lastOfMonth } },
          include: { staff: true },
          orderBy: { startTime: "asc" },
        })
      : Promise.resolve([]),
    singleStoreId
      ? prisma.storeEvent.findMany({
          where: { storeId: singleStoreId, startAt: { gte: addDays(firstOfMonth, -1), lte: addDays(lastOfMonth, 1) } },
          orderBy: { startAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const totals = sales.reduce(
    (acc, s) => {
      acc.cash += s.cashAmount;
      acc.card += s.cardAmount;
      acc.other += s.otherAmount;
      return acc;
    },
    { cash: 0, card: 0, other: 0 },
  );
  const grandTotal = totals.cash + totals.card + totals.other;

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  const days: Date[] = [];
  for (let d = firstOfMonth; d <= lastOfMonth; d = addDays(d, 1)) {
    days.push(d);
  }
  const salesByDate = new Map(sales.map((s) => [formatDate(s.date), s]));

  const shiftsByDate = new Map<string, typeof gridShifts>();
  for (const shift of gridShifts) {
    const key = formatDate(shift.workDate);
    shiftsByDate.set(key, [...(shiftsByDate.get(key) ?? []), shift]);
  }
  const eventsByDate = new Map<string, typeof gridEvents>();
  for (const event of gridEvents) {
    const key = jstDateKey(event.startAt);
    eventsByDate.set(key, [...(eventsByDate.get(key) ?? []), event]);
  }

  return (
    <>
      <Nav userEmail={session?.user?.email} />
      <main style={{ padding: "2rem", maxWidth: 1080, margin: "0 auto" }}>
        <h1>売上</h1>

        <div style={{ marginTop: "1rem" }}>
          <div style={{ fontSize: "0.85rem", marginBottom: "0.25rem" }}>
            店舗（1店舗のみでExcel風の一括入力ができます）
          </div>
          <StoreFilterChips stores={stores} storeIds={storeIds} year={year} month={month} basePath="/sales" />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
          <Link href={monthLink(prevMonth.year, prevMonth.month, storeIds)}>← 前の月</Link>
          <strong>
            {year}年{month}月
          </strong>
          <Link href={monthLink(nextMonth.year, nextMonth.month, storeIds)}>次の月 →</Link>
        </div>

        {storeIds.length === 1 && canWrite ? (
          <form action={bulkUpsertSales} style={{ marginTop: "1.5rem" }}>
            <input type="hidden" name="storeId" value={storeIds[0]} />
            <input type="hidden" name="dates" value={days.map((d) => formatDate(d)).join(",")} />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>日付</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>現金</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>カード</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>その他</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>合計</th>
                    <th style={thStyle}>メモ</th>
                    <th style={thStyle}>イベント</th>
                    <th style={thStyle}>シフト</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => {
                    const key = formatDate(day);
                    const existing = salesByDate.get(key);
                    const total = (existing?.cashAmount ?? 0) + (existing?.cardAmount ?? 0) + (existing?.otherAmount ?? 0);
                    const dayEvents = eventsByDate.get(key) ?? [];
                    const dayShifts = shiftsByDate.get(key) ?? [];
                    return (
                      <tr key={key}>
                        <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                          {day.getUTCDate()}日（{WEEKDAY_LABEL_JA[day.getUTCDay()]}）
                        </td>
                        <td style={tdStyle}>
                          <input
                            type="number"
                            name={`cash_${key}`}
                            min={0}
                            defaultValue={existing?.cashAmount ?? 0}
                            style={{ width: "100%", textAlign: "right" }}
                          />
                        </td>
                        <td style={tdStyle}>
                          <input
                            type="number"
                            name={`card_${key}`}
                            min={0}
                            defaultValue={existing?.cardAmount ?? 0}
                            style={{ width: "100%", textAlign: "right" }}
                          />
                        </td>
                        <td style={tdStyle}>
                          <input
                            type="number"
                            name={`other_${key}`}
                            min={0}
                            defaultValue={existing?.otherAmount ?? 0}
                            style={{ width: "100%", textAlign: "right" }}
                          />
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", color: "#888" }}>{yen(total)}</td>
                        <td style={tdStyle}>
                          <input type="text" name={`note_${key}`} defaultValue={existing?.note ?? ""} style={{ width: "100%" }} />
                        </td>
                        <td style={{ ...tdStyle, minWidth: 140 }}>
                          {dayEvents.length === 0
                            ? <span style={{ color: "#bbb" }}>-</span>
                            : dayEvents.map((event) => (
                                <div
                                  key={event.id}
                                  style={{ fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                                  title={event.name}
                                >
                                  📅 {event.name}
                                </div>
                              ))}
                        </td>
                        <td style={{ ...tdStyle, minWidth: 140 }}>
                          {dayShifts.length === 0
                            ? <span style={{ color: "#bbb" }}>-</span>
                            : dayShifts.map((shift) => (
                                <div
                                  key={shift.id}
                                  style={{ fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                                  title={`${shift.staff.name} ${shift.startTime}-${shift.endTime}`}
                                >
                                  {shift.startTime} {shift.staff.name}
                                </div>
                              ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ ...tdStyle, fontWeight: "bold" }}>合計</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(totals.cash)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(totals.card)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(totals.other)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(grandTotal)}</td>
                    <td style={tdStyle} />
                    <td style={tdStyle} />
                    <td style={tdStyle} />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.5rem" }}>
              金額・メモをすべて空（0）にして保存すると、その日のデータは削除されます。「合計」列は前回保存時点の値です。
            </p>
            <button type="submit" style={{ marginTop: "0.5rem" }}>
              まとめて保存
            </button>
          </form>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1.5rem" }}>
            <thead>
              <tr>
                <th style={thStyle}>日付</th>
                {showStoreName && <th style={thStyle}>店舗</th>}
                <th style={{ ...thStyle, textAlign: "right" }}>現金</th>
                <th style={{ ...thStyle, textAlign: "right" }}>カード</th>
                <th style={{ ...thStyle, textAlign: "right" }}>その他</th>
                <th style={{ ...thStyle, textAlign: "right" }}>合計</th>
                <th style={thStyle}>メモ</th>
                {canWrite && <th style={thStyle} />}
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 && (
                <tr>
                  <td colSpan={showStoreName ? 8 : 7} style={{ ...tdStyle, color: "#888" }}>
                    売上データはありません。1店舗のみを選択するとExcel風の一括入力ができます。
                  </td>
                </tr>
              )}
              {sales.map((s) => {
                const total = s.cashAmount + s.cardAmount + s.otherAmount;
                return (
                  <tr key={s.id}>
                    <td style={tdStyle}>{formatDate(s.date)}</td>
                    {showStoreName && <td style={tdStyle}>{s.store.name}</td>}
                    <td style={{ ...tdStyle, textAlign: "right" }}>{yen(s.cashAmount)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{yen(s.cardAmount)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{yen(s.otherAmount)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(total)}</td>
                    <td style={tdStyle}>{s.note}</td>
                    {canWrite && (
                      <td style={tdStyle}>
                        <form action={deleteSales}>
                          <input type="hidden" name="id" value={s.id} />
                          <button type="submit">削除</button>
                        </form>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {sales.length > 0 && (
              <tfoot>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: "bold" }} colSpan={showStoreName ? 2 : 1}>
                    合計
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(totals.cash)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(totals.card)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(totals.other)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(grandTotal)}</td>
                  <td style={tdStyle} />
                  {canWrite && <td style={tdStyle} />}
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </main>
    </>
  );
}
