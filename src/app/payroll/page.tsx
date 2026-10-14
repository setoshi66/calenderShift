import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { StoreFilterChips } from "@/components/store-filter-chips";
import { thStyle, tdStyle } from "@/lib/table-styles";
import { shiftHours, todayInJst } from "@/lib/date";
import { appendStoreIdsToParams, resolveStoreIds } from "@/lib/array";
import { getViewMode } from "@/lib/view-mode";
import { getStoredStoreIds } from "@/lib/store-filter";

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

  const [staffList, shifts] = await Promise.all([
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
  ]);

  const hoursByStaff = new Map<string, number>();
  for (const shift of shifts) {
    if (shift.status === "CANCELLED") continue;
    const hours = shiftHours(shift.startTime, shift.endTime, shift.breakMinutes);
    hoursByStaff.set(shift.staffId, (hoursByStaff.get(shift.staffId) ?? 0) + hours);
  }

  const rows = staffList.map((staff) => {
    const hours = hoursByStaff.get(staff.id) ?? 0;
    const pay = staff.hourlyWage != null ? hours * staff.hourlyWage : null;
    return { staff, hours, pay };
  });

  const totalHours = rows.reduce((sum, r) => sum + r.hours, 0);
  const totalPay = rows.reduce((sum, r) => sum + (r.pay ?? 0), 0);

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  return (
    <>
      <Nav userEmail={session?.user?.email} viewMode={viewMode} title="給与計算" isAdmin />
      <main style={{ padding: "2rem", maxWidth: 960, margin: "0 auto" }}>
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

        <div style={{ overflowX: "auto", marginTop: "1rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>氏名</th>
                <th style={{ ...thStyle, textAlign: "right" }}>勤務時間</th>
                <th style={{ ...thStyle, textAlign: "right" }}>時給</th>
                <th style={{ ...thStyle, textAlign: "right" }}>給与</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, color: "#888" }}>
                    該当するスタッフがいません。
                  </td>
                </tr>
              ) : (
                rows.map(({ staff, hours, pay }) => (
                  <tr key={staff.id}>
                    <td style={tdStyle}>{staff.name}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{hours.toFixed(1)}時間</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {staff.hourlyWage != null ? yen(staff.hourlyWage) : "未設定"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>
                      {pay != null ? yen(pay) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: "bold" }}>合計</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{totalHours.toFixed(1)}時間</td>
                  <td style={tdStyle} />
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{yen(totalPay)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <p style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.75rem" }}>
          時給が未設定のスタッフは給与が計算されません（スタッフページで設定してください）。取消済みのシフトは勤務時間に含まれません。
        </p>
      </main>
    </>
  );
}
