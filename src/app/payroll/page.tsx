import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { StoreFilterChips } from "@/components/store-filter-chips";
import { PayrollHoursInputs } from "@/components/payroll-hours-inputs";
import { thStyle, tdStyle } from "@/lib/table-styles";
import { shiftHours, todayInJst } from "@/lib/date";
import { appendStoreIdsToParams, resolveStoreIds } from "@/lib/array";
import { getViewMode } from "@/lib/view-mode";
import { getStoredStoreIds } from "@/lib/store-filter";
import { bulkUpsertPayroll } from "./actions";

function yen(n: number) {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

function monthLink(year: number, month: number, storeIds: string[]) {
  const q = new URLSearchParams({ year: String(year), month: String(month) });
  appendStoreIdsToParams(q, storeIds);
  return `/payroll?${q.toString()}`;
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string | string[]; year?: string; month?: string }>;
}) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    redirect("/");
  }

  const params = await searchParams;
  const today = todayInJst();
  const viewMode = await getViewMode();

  const year = Number(params.year) || today.getUTCFullYear();
  const month = Number(params.month) || today.getUTCMonth() + 1; // 1-12

  const [stores, storedStoreIds] = await Promise.all([
    prisma.store.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    getStoredStoreIds(),
  ]);
  const storeIds = resolveStoreIds(params.storeId, storedStoreIds, stores.map((s) => s.id));

  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const lastOfMonth = new Date(Date.UTC(year, month, 0));

  const [staffList, shifts, payrollEntries] = await Promise.all([
    prisma.staff.findMany({
      where: {
        isActive: true,
        storeAssignments: { some: { storeId: { in: storeIds } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.shift.findMany({
      where: {
        storeId: { in: storeIds },
        workDate: { gte: firstOfMonth, lte: lastOfMonth },
      },
    }),
    prisma.payrollEntry.findMany({ where: { month: firstOfMonth } }),
  ]);

  const shiftHoursByStaff = new Map<string, number>();
  for (const shift of shifts) {
    if (shift.status === "CANCELLED") continue;
    const hours = shiftHours(shift.startTime, shift.endTime, shift.breakMinutes);
    shiftHoursByStaff.set(shift.staffId, (shiftHoursByStaff.get(shift.staffId) ?? 0) + hours);
  }
  const payrollByStaff = new Map(payrollEntries.map((p) => [p.staffId, p]));

  const rows = staffList.map((staff) => {
    const shiftHoursTotal = shiftHoursByStaff.get(staff.id) ?? 0;
    const existing = payrollByStaff.get(staff.id);
    const extraHours = existing?.extraHours ?? 0;
    const totalHours = existing?.totalHours ?? shiftHoursTotal + extraHours;
    const commission1 = existing?.commission1 ?? 0;
    const commission2 = existing?.commission2 ?? 0;
    const commission3 = existing?.commission3 ?? 0;
    const commission4 = existing?.commission4 ?? 0;
    const workPay = staff.hourlyWage != null ? totalHours * staff.hourlyWage : 0;
    const totalPay = workPay + commission1 + commission2 + commission3 + commission4;
    return { staff, shiftHoursTotal, extraHours, totalHours, commission1, commission2, commission3, commission4, workPay, totalPay };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.shiftHours += r.shiftHoursTotal;
      acc.totalHours += r.totalHours;
      acc.workPay += r.workPay;
      acc.commission1 += r.commission1;
      acc.commission2 += r.commission2;
      acc.commission3 += r.commission3;
      acc.commission4 += r.commission4;
      acc.totalPay += r.totalPay;
      return acc;
    },
    { shiftHours: 0, totalHours: 0, workPay: 0, commission1: 0, commission2: 0, commission3: 0, commission4: 0, totalPay: 0 },
  );

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const monthValue = firstOfMonth.toISOString().slice(0, 10);

  return (
    <>
      <Nav userEmail={session?.user?.email} viewMode={viewMode} title="給与計算" isAdmin />
      <main style={{ padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginTop: "1rem" }}>
          <div style={{ fontSize: "0.85rem", marginBottom: "0.25rem" }}>店舗</div>
          <StoreFilterChips stores={stores} storeIds={storeIds} year={year} month={month} basePath="/payroll" />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
          <Link href={monthLink(prevMonth.year, prevMonth.month, storeIds)}>← 前の月</Link>
          <strong>
            {year}年{month}月
          </strong>
          <Link href={monthLink(nextMonth.year, nextMonth.month, storeIds)}>次の月 →</Link>
        </div>

        <form action={bulkUpsertPayroll} style={{ marginTop: "1rem" }}>
          <input type="hidden" name="month" value={monthValue} />
          <input type="hidden" name="staffIds" value={rows.map((r) => r.staff.id).join(",")} />

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>氏名</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>勤務時間(シフト)</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>勤務時間(追加)</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>勤務時間(合計)</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>時給</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>勤務報酬</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>歩合1</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>歩合2</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>歩合3</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>歩合4</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>報酬合計</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ ...tdStyle, color: "#888" }}>
                      該当するスタッフがいません。
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.staff.id}>
                      <td style={tdStyle}>{r.staff.name}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{r.shiftHoursTotal.toFixed(1)}</td>
                      <PayrollHoursInputs
                        staffId={r.staff.id}
                        shiftHours={r.shiftHoursTotal}
                        defaultExtraHours={r.extraHours}
                        defaultTotalHours={r.totalHours}
                      />
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {r.staff.hourlyWage != null ? yen(r.staff.hourlyWage) : "未設定"}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{yen(r.workPay)}</td>
                      <td style={tdStyle}>
                        <input type="number" name={`commission1_${r.staff.id}`} defaultValue={r.commission1} style={{ width: "100%", textAlign: "right" }} />
                      </td>
                      <td style={tdStyle}>
                        <input type="number" name={`commission2_${r.staff.id}`} defaultValue={r.commission2} style={{ width: "100%", textAlign: "right" }} />
                      </td>
                      <td style={tdStyle}>
                        <input type="number" name={`commission3_${r.staff.id}`} defaultValue={r.commission3} style={{ width: "100%", textAlign: "right" }} />
                      </td>
                      <td style={tdStyle}>
                        <input type="number" name={`commission4_${r.staff.id}`} defaultValue={r.commission4} style={{ width: "100%", textAlign: "right" }} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(r.totalPay)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr>
                    <td style={{ ...tdStyle, fontWeight: "bold" }}>合計</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{totals.shiftHours.toFixed(1)}</td>
                    <td style={tdStyle} />
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{totals.totalHours.toFixed(1)}</td>
                    <td style={tdStyle} />
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(totals.workPay)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(totals.commission1)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(totals.commission2)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(totals.commission3)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(totals.commission4)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(totals.totalPay)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {rows.length > 0 && (
            <button type="submit" style={{ marginTop: "0.75rem" }}>
              まとめて保存
            </button>
          )}
        </form>

        <p style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.75rem" }}>
          勤務時間(合計)は初期値としてシフト+追加の合計が入ります（追加を変更すると自動的に再計算されますが、直接書き換えることもできます）。
          時給が未設定のスタッフは勤務報酬が0円になります。「勤務報酬」「報酬合計」は保存済みの値から計算した表示で、保存するまで更新されません。
        </p>
      </main>
    </>
  );
}
