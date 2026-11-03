import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { StoreFilterChips } from "@/components/store-filter-chips";
import { thStyle, tdStyle } from "@/lib/table-styles";
import { addDays, formatDate, jstDateKey, todayInJst, WEEKDAY_LABEL_JA } from "@/lib/date";
import { appendStoreIdsToParams, resolveStoreIds } from "@/lib/array";
import { getViewMode } from "@/lib/view-mode";
import { getStoredStoreIds } from "@/lib/store-filter";
import { bulkUpsertSales, deleteSales } from "./actions";

function yen(n: number) {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

function monthLink(year: number, month: number, storeIds: string[]) {
  const q = new URLSearchParams({ year: String(year), month: String(month) });
  appendStoreIdsToParams(q, storeIds);
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
  const viewMode = await getViewMode();

  const year = Number(params.year) || today.getUTCFullYear();
  const month = Number(params.month) || today.getUTCMonth() + 1; // 1-12

  const [stores, storedStoreIds] = await Promise.all([
    prisma.store.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    getStoredStoreIds(),
  ]);
  const storeIds = resolveStoreIds(params.storeId, storedStoreIds, stores.map((s) => s.id));
  const showStoreName = storeIds.length !== 1;

  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const lastOfMonth = new Date(Date.UTC(year, month, 0));
  const singleStoreId = storeIds.length === 1 ? storeIds[0] : undefined;

  const [sales, gridShifts, gridEvents, priorDaySales] = await Promise.all([
    prisma.dailySales.findMany({
      where: {
        storeId: { in: storeIds },
        date: { gte: firstOfMonth, lte: lastOfMonth },
      },
      include: { store: true },
      orderBy: [{ date: "asc" }, { storeId: "asc" }],
    }),
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
    // 想定現金有高の算出に使う、月初前日の実際現金有高
    singleStoreId
      ? prisma.dailySales.findUnique({
          where: { storeId_date: { storeId: singleStoreId, date: addDays(firstOfMonth, -1) } },
          select: { actualCashAmount: true },
        })
      : Promise.resolve(null),
  ]);

  const totals = sales.reduce(
    (acc, s) => {
      acc.cash += s.cashAmount;
      acc.other += s.otherAmount;
      acc.token += s.tokenAmount;
      acc.transferWallet += s.transferWalletAmount;
      acc.purchaseWallet += s.purchaseWalletAmount;
      return acc;
    },
    { cash: 0, other: 0, token: 0, transferWallet: 0, purchaseWallet: 0 },
  );
  const grandTotal = totals.cash + totals.other + totals.token;

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  const days: Date[] = [];
  for (let d = firstOfMonth; d <= lastOfMonth; d = addDays(d, 1)) {
    days.push(d);
  }
  const salesByDate = new Map(sales.map((s) => [formatDate(s.date), s]));

  // 想定現金有高・現金誤差を日付順に連鎖計算する。
  // 本日の想定現金有高 = 前日の実際現金有高 - 本日の(現金売上+振込財布へ+買出財布へ)
  const expectedCashByDate = new Map<string, number | null>();
  const cashDiscrepancyByDate = new Map<string, number | null>();
  let prevActualCash: number | null = priorDaySales?.actualCashAmount ?? null;
  for (const day of days) {
    const key = formatDate(day);
    const existing = salesByDate.get(key);
    const expectedCash =
      prevActualCash != null
        ? prevActualCash - (existing?.cashAmount ?? 0) - (existing?.transferWalletAmount ?? 0) - (existing?.purchaseWalletAmount ?? 0)
        : null;
    const discrepancy = existing?.actualCashAmount != null && expectedCash != null ? existing.actualCashAmount - expectedCash : null;
    expectedCashByDate.set(key, expectedCash);
    cashDiscrepancyByDate.set(key, discrepancy);
    prevActualCash = existing?.actualCashAmount ?? null;
  }

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

  if (viewMode === "sp") {
    const fieldStyle = { width: "100%", padding: "0.4rem" };

    return (
      <>
        <Nav userEmail={session?.user?.email} viewMode={viewMode} title="売上" isAdmin={session?.user.role === "ADMIN"} />
        <main style={{ padding: "1rem", maxWidth: 480, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link href={monthLink(prevMonth.year, prevMonth.month, storeIds)} style={{ fontSize: "1.4rem", padding: "0.4rem 0.7rem" }}>
              ‹
            </Link>
            <strong style={{ fontSize: "1.1rem" }}>
              {year}年{month}月
            </strong>
            <Link href={monthLink(nextMonth.year, nextMonth.month, storeIds)} style={{ fontSize: "1.4rem", padding: "0.4rem 0.7rem" }}>
              ›
            </Link>
          </div>

          <div style={{ marginTop: "0.75rem" }}>
            <div style={{ fontSize: "0.85rem", marginBottom: "0.25rem" }}>
              店舗（1店舗のみでExcel風の一括入力ができます）
            </div>
            <StoreFilterChips stores={stores} storeIds={storeIds} year={year} month={month} basePath="/sales" />
          </div>

          {storeIds.length === 1 && canWrite ? (
            <form action={bulkUpsertSales} style={{ marginTop: "1rem" }}>
              <input type="hidden" name="storeId" value={storeIds[0]} />
              <input type="hidden" name="dates" value={days.map((d) => formatDate(d)).join(",")} />

              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {days.map((day) => {
                  const key = formatDate(day);
                  const existing = salesByDate.get(key);
                  const total = (existing?.cashAmount ?? 0) + (existing?.otherAmount ?? 0) + (existing?.tokenAmount ?? 0);
                  const expectedCash = expectedCashByDate.get(key) ?? null;
                  const discrepancy = cashDiscrepancyByDate.get(key) ?? null;
                  const dayEvents = eventsByDate.get(key) ?? [];
                  const dayShifts = shiftsByDate.get(key) ?? [];
                  const weekday = day.getUTCDay();
                  const dateColor = weekday === 6 ? "#1a5fd6" : weekday === 0 ? "#d61a1a" : undefined;

                  return (
                    <div key={key} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "0.75rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", color: dateColor }}>
                        <span>
                          {day.getUTCDate()}日（{WEEKDAY_LABEL_JA[weekday]}）
                        </span>
                        <span style={{ color: "#888", fontWeight: "normal" }}>売上合計 {yen(total)}</span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
                        <label style={{ fontSize: "0.8rem" }}>
                          現金
                          <input type="number" name={`cash_${key}`} min={0} defaultValue={existing?.cashAmount ?? 0} style={fieldStyle} />
                        </label>
                        <label style={{ fontSize: "0.8rem" }}>
                          その他
                          <input type="number" name={`other_${key}`} min={0} defaultValue={existing?.otherAmount ?? 0} style={fieldStyle} />
                        </label>
                        <label style={{ fontSize: "0.8rem" }}>
                          トークン売上
                          <input type="number" name={`token_${key}`} min={0} defaultValue={existing?.tokenAmount ?? 0} style={fieldStyle} />
                        </label>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
                        <label style={{ fontSize: "0.8rem" }}>
                          振込財布へ
                          <input
                            type="number"
                            name={`transferWallet_${key}`}
                            min={0}
                            defaultValue={existing?.transferWalletAmount ?? 0}
                            style={fieldStyle}
                          />
                        </label>
                        <label style={{ fontSize: "0.8rem" }}>
                          買出財布へ
                          <input
                            type="number"
                            name={`purchaseWallet_${key}`}
                            min={0}
                            defaultValue={existing?.purchaseWalletAmount ?? 0}
                            style={fieldStyle}
                          />
                        </label>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
                        <label style={{ fontSize: "0.8rem" }}>
                          実際現金有高
                          <input
                            type="number"
                            name={`actualCash_${key}`}
                            min={0}
                            defaultValue={existing?.actualCashAmount ?? ""}
                            style={fieldStyle}
                          />
                        </label>
                        <div style={{ fontSize: "0.8rem" }}>
                          想定現金有高
                          <div style={{ padding: "0.4rem 0", color: "#555" }}>{expectedCash != null ? yen(expectedCash) : "-"}</div>
                        </div>
                        <div style={{ fontSize: "0.8rem" }}>
                          現金誤差
                          <div style={{ padding: "0.4rem 0", color: discrepancy ? (discrepancy < 0 ? "#d61a1a" : "#1a7a1a") : "#555" }}>
                            {discrepancy != null ? yen(discrepancy) : "-"}
                          </div>
                        </div>
                      </div>

                      <label style={{ fontSize: "0.8rem", display: "block", marginTop: "0.5rem" }}>
                        メモ
                        <input type="text" name={`note_${key}`} defaultValue={existing?.note ?? ""} style={fieldStyle} />
                      </label>

                      {(dayEvents.length > 0 || dayShifts.length > 0) && (
                        <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#666" }}>
                          {dayEvents.map((event) => (
                            <div key={event.id}>📅 {event.name}</div>
                          ))}
                          {dayShifts.map((shift) => (
                            <div key={shift.id}>
                              {shift.startTime}-{shift.endTime} {shift.staff.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "#f5f5f5", borderRadius: 8 }}>
                <div>現金合計: {yen(totals.cash)}</div>
                <div>その他合計: {yen(totals.other)}</div>
                <div>トークン売上合計: {yen(totals.token)}</div>
                <div style={{ fontWeight: "bold" }}>売上総合計: {yen(grandTotal)}</div>
                <div style={{ marginTop: "0.4rem" }}>振込財布へ合計: {yen(totals.transferWallet)}</div>
                <div>買出財布へ合計: {yen(totals.purchaseWallet)}</div>
              </div>

              <p style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.5rem" }}>
                金額・メモをすべて空（0・未入力）にして保存すると、その日のデータは削除されます。
                想定現金有高 = 前日の実際現金有高 − 本日の(現金売上+振込財布へ+買出財布へ)。前日分が未入力の月は計算できません。
              </p>
              <button type="submit" style={{ marginTop: "0.5rem", width: "100%", padding: "0.6rem" }}>
                まとめて保存
              </button>
            </form>
          ) : (
            <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {sales.length === 0 && (
                <p style={{ color: "#888", fontSize: "0.9rem" }}>
                  売上データはありません。1店舗のみを選択するとExcel風の一括入力ができます。
                </p>
              )}
              {sales.map((s) => {
                const total = s.cashAmount + s.otherAmount + s.tokenAmount;
                return (
                  <div key={s.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                      <span>
                        {formatDate(s.date)}
                        {showStoreName && ` (${s.store.name})`}
                      </span>
                      <span>{yen(total)}</span>
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>
                      現金 {yen(s.cashAmount)} / その他 {yen(s.otherAmount)} / トークン売上 {yen(s.tokenAmount)}
                    </div>
                    {s.note && <div style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>{s.note}</div>}
                    {canWrite && (
                      <form action={deleteSales} style={{ marginTop: "0.5rem" }}>
                        <input type="hidden" name="id" value={s.id} />
                        <button type="submit">削除</button>
                      </form>
                    )}
                  </div>
                );
              })}
              {sales.length > 0 && (
                <div style={{ padding: "0.75rem", background: "#f5f5f5", borderRadius: 8 }}>
                  <div>現金合計: {yen(totals.cash)}</div>
                  <div>その他合計: {yen(totals.other)}</div>
                  <div>トークン売上合計: {yen(totals.token)}</div>
                  <div style={{ fontWeight: "bold" }}>売上総合計: {yen(grandTotal)}</div>
                </div>
              )}
            </div>
          )}
        </main>
      </>
    );
  }

  return (
    <>
      <Nav userEmail={session?.user?.email} viewMode={viewMode} title="売上" isAdmin={session?.user.role === "ADMIN"} />
      <main style={{ padding: "2rem", maxWidth: "100%", margin: "0 auto" }}>
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
              <table style={{ width: "100%", borderCollapse: "collapse", whiteSpace: "nowrap" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>日付</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>現金</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>その他</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>トークン売上</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>売上合計</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>振込財布へ</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>買出財布へ</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>実際現金有高</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>想定現金有高</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>現金誤差</th>
                    <th style={thStyle}>メモ</th>
                    <th style={thStyle}>イベント</th>
                    <th style={thStyle}>シフト</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => {
                    const key = formatDate(day);
                    const existing = salesByDate.get(key);
                    const total = (existing?.cashAmount ?? 0) + (existing?.otherAmount ?? 0) + (existing?.tokenAmount ?? 0);
                    const expectedCash = expectedCashByDate.get(key) ?? null;
                    const discrepancy = cashDiscrepancyByDate.get(key) ?? null;
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
                            name={`other_${key}`}
                            min={0}
                            defaultValue={existing?.otherAmount ?? 0}
                            style={{ width: "100%", textAlign: "right" }}
                          />
                        </td>
                        <td style={tdStyle}>
                          <input
                            type="number"
                            name={`token_${key}`}
                            min={0}
                            defaultValue={existing?.tokenAmount ?? 0}
                            style={{ width: "100%", textAlign: "right" }}
                          />
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", color: "#888" }}>{yen(total)}</td>
                        <td style={tdStyle}>
                          <input
                            type="number"
                            name={`transferWallet_${key}`}
                            min={0}
                            defaultValue={existing?.transferWalletAmount ?? 0}
                            style={{ width: "100%", textAlign: "right" }}
                          />
                        </td>
                        <td style={tdStyle}>
                          <input
                            type="number"
                            name={`purchaseWallet_${key}`}
                            min={0}
                            defaultValue={existing?.purchaseWalletAmount ?? 0}
                            style={{ width: "100%", textAlign: "right" }}
                          />
                        </td>
                        <td style={tdStyle}>
                          <input
                            type="number"
                            name={`actualCash_${key}`}
                            min={0}
                            defaultValue={existing?.actualCashAmount ?? ""}
                            style={{ width: "100%", textAlign: "right" }}
                          />
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", color: "#888" }}>{expectedCash != null ? yen(expectedCash) : "-"}</td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            color: discrepancy ? (discrepancy < 0 ? "#d61a1a" : "#1a7a1a") : "#888",
                          }}
                        >
                          {discrepancy != null ? yen(discrepancy) : "-"}
                        </td>
                        <td style={tdStyle}>
                          <input type="text" name={`note_${key}`} defaultValue={existing?.note ?? ""} style={{ width: "100%" }} />
                        </td>
                        <td style={{ ...tdStyle, minWidth: 140 }}>
                          {dayEvents.length === 0 ? (
                            <span style={{ color: "#bbb" }}>-</span>
                          ) : (
                            dayEvents.map((event) => (
                              <div
                                key={event.id}
                                style={{ fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                                title={event.name}
                              >
                                📅 {event.name}
                              </div>
                            ))
                          )}
                        </td>
                        <td style={{ ...tdStyle, minWidth: 140 }}>
                          {dayShifts.length === 0 ? (
                            <span style={{ color: "#bbb" }}>-</span>
                          ) : (
                            dayShifts.map((shift) => (
                              <div
                                key={shift.id}
                                style={{ fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                                title={`${shift.staff.name} ${shift.startTime}-${shift.endTime}`}
                              >
                                {shift.startTime} {shift.staff.name}
                              </div>
                            ))
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ ...tdStyle, fontWeight: "bold" }}>合計</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(totals.cash)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(totals.other)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(totals.token)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(grandTotal)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(totals.transferWallet)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(totals.purchaseWallet)}</td>
                    <td style={tdStyle} />
                    <td style={tdStyle} />
                    <td style={tdStyle} />
                    <td style={tdStyle} />
                    <td style={tdStyle} />
                    <td style={tdStyle} />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.5rem" }}>
              金額・メモをすべて空（0・未入力）にして保存すると、その日のデータは削除されます。「売上合計」「想定現金有高」「現金誤差」列は前回保存時点の値です。
              想定現金有高 = 前日の実際現金有高 − 本日の(現金売上+振込財布へ+買出財布へ)。前日分が未入力の場合は計算できません。
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
                <th style={{ ...thStyle, textAlign: "right" }}>その他</th>
                <th style={{ ...thStyle, textAlign: "right" }}>トークン売上</th>
                <th style={{ ...thStyle, textAlign: "right" }}>売上合計</th>
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
                const total = s.cashAmount + s.otherAmount + s.tokenAmount;
                return (
                  <tr key={s.id}>
                    <td style={tdStyle}>{formatDate(s.date)}</td>
                    {showStoreName && <td style={tdStyle}>{s.store.name}</td>}
                    <td style={{ ...tdStyle, textAlign: "right" }}>{yen(s.cashAmount)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{yen(s.otherAmount)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{yen(s.tokenAmount)}</td>
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
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(totals.other)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(totals.token)}</td>
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
