import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { AddShiftDialog } from "@/components/add-shift-dialog";
import { AddEventDialog } from "@/components/add-event-dialog";
import { EditEventDialog } from "@/components/edit-event-dialog";
import { ShiftBadge } from "@/components/shift-badge";
import { StoreFilterChips } from "@/components/store-filter-chips";
import { addDays, formatDate, jstDateKey, shiftHours, todayInJst, WEEKDAY_LABEL_JA } from "@/lib/date";
import { toArray } from "@/lib/array";
import { createShift, deleteShift, updateShiftStatus } from "./actions";
import { createEvent, deleteEvent, updateEvent } from "@/app/events/actions";

function monthLink(year: number, month: number, storeIds: string[], staffId: string | undefined) {
  const q = new URLSearchParams({ year: String(year), month: String(month) });
  storeIds.forEach((id) => q.append("storeId", id));
  if (staffId) q.set("staffId", staffId);
  return `/shifts?${q.toString()}`;
}

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string | string[]; staffId?: string; year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const canWrite = session?.user.role === "ADMIN" || session?.user.role === "STORE_MANAGER";
  const today = todayInJst();

  const year = Number(params.year) || today.getUTCFullYear();
  const month = Number(params.month) || today.getUTCMonth() + 1; // 1-12
  const storeIds = toArray(params.storeId);
  const showStoreName = storeIds.length !== 1;
  const staffId = params.staffId || undefined;

  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const lastOfMonth = new Date(Date.UTC(year, month, 0));
  const days: Date[] = [];
  for (let d = firstOfMonth; d <= lastOfMonth; d = addDays(d, 1)) {
    days.push(d);
  }

  const [staffList, shifts, stores, storeEvents] = await Promise.all([
    prisma.staff.findMany({
      where: {
        isActive: true,
        id: staffId,
        storeAssignments: storeIds.length ? { some: { storeId: { in: storeIds } } } : undefined,
      },
      orderBy: { name: "asc" },
    }),
    prisma.shift.findMany({
      where: {
        storeId: storeIds.length ? { in: storeIds } : undefined,
        staffId,
        workDate: { gte: firstOfMonth, lte: lastOfMonth },
      },
      include: { store: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.store.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.storeEvent.findMany({
      where: {
        storeId: storeIds.length ? { in: storeIds } : undefined,
        startAt: { gte: addDays(firstOfMonth, -1), lte: addDays(lastOfMonth, 1) },
      },
      include: { store: true },
      orderBy: { startAt: "asc" },
    }),
  ]);

  const shiftsByStaffAndDate = new Map<string, typeof shifts>();
  for (const shift of shifts) {
    const key = `${shift.staffId}_${formatDate(shift.workDate)}`;
    shiftsByStaffAndDate.set(key, [...(shiftsByStaffAndDate.get(key) ?? []), shift]);
  }

  const eventsByDate = new Map<string, typeof storeEvents>();
  for (const event of storeEvents) {
    const key = jstDateKey(event.startAt);
    eventsByDate.set(key, [...(eventsByDate.get(key) ?? []), event]);
  }

  const selectedStores = stores.filter((s) => storeIds.includes(s.id));

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const todayKey = formatDate(today);

  return (
    <>
      <Nav userEmail={session?.user?.email} />
      <main style={{ padding: "2rem", maxWidth: "100%", margin: "0 auto" }}>
        <h1>シフト</h1>

        <div style={{ marginTop: "1rem" }}>
          <div style={{ fontSize: "0.85rem", marginBottom: "0.25rem" }}>店舗</div>
          <StoreFilterChips
            stores={stores}
            storeIds={storeIds}
            year={year}
            month={month}
            basePath="/shifts"
            extraParams={staffId ? { staffId } : undefined}
          />
        </div>

        <form method="get" style={{ display: "flex", gap: "0.75rem", alignItems: "end", marginTop: "0.75rem" }}>
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          {storeIds.map((id) => (
            <input key={id} type="hidden" name="storeId" value={id} />
          ))}
          <label>
            スタッフ
            <select name="staffId" defaultValue={staffId ?? ""}>
              <option value="">すべて</option>
              {staffList.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">絞り込み</button>
        </form>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
          <Link href={monthLink(prevMonth.year, prevMonth.month, storeIds, staffId)}>← 前の月</Link>
          <strong>
            {year}年{month}月
          </strong>
          <Link href={monthLink(nextMonth.year, nextMonth.month, storeIds, staffId)}>次の月 →</Link>
        </div>

        <div style={{ overflowX: "auto", marginTop: "1rem" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th
                  style={{
                    position: "sticky",
                    left: 0,
                    background: "#f5f5f5",
                    textAlign: "left",
                    padding: "0.35rem 0.5rem",
                    border: "1px solid #ccc",
                    minWidth: 80,
                  }}
                >
                  日付
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: "0.35rem 0.5rem",
                    border: "1px solid #ccc",
                    background: "#f5f5f5",
                    minWidth: 130,
                    fontWeight: "normal",
                    fontSize: "0.8rem",
                  }}
                >
                  イベント
                </th>
                {staffList.length === 0 ? (
                  <th style={{ border: "1px solid #ccc", background: "#f5f5f5" }} />
                ) : (
                  staffList.map((staff) => (
                    <th
                      key={staff.id}
                      style={{
                        textAlign: "center",
                        padding: "0.35rem 0.5rem",
                        border: "1px solid #ccc",
                        background: "#f5f5f5",
                        minWidth: 110,
                        fontWeight: "normal",
                        fontSize: "0.8rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {staffId ? "シフト" : staff.name}
                    </th>
                  ))
                )}
                {staffId && (
                  <th
                    style={{
                      textAlign: "center",
                      padding: "0.35rem 0.5rem",
                      border: "1px solid #ccc",
                      background: "#f5f5f5",
                      minWidth: 90,
                      fontWeight: "normal",
                      fontSize: "0.8rem",
                    }}
                  >
                    勤務時間
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={staffId ? 4 : 3} style={{ color: "#888", padding: "0.75rem 0", border: "1px solid #ccc" }}>
                    該当するスタッフがいません。
                  </td>
                </tr>
              ) : (
                days.map((day) => {
                  const dayKey = formatDate(day);
                  const dayEvents = eventsByDate.get(dayKey) ?? [];
                  const rowBackground =
                    dayEvents.length > 0
                      ? dayKey === todayKey
                        ? "#fffbe6"
                        : undefined
                      : dayKey === todayKey
                        ? "#fffbe6"
                        : "#bbb";
                  return (
                    <tr key={dayKey}>
                      <td
                        style={{
                          position: "sticky",
                          left: 0,
                          background: rowBackground ?? "#fff",
                          padding: "0.35rem 0.5rem",
                          border: "1px solid #ddd",
                          whiteSpace: "nowrap",
                          fontSize: "0.8rem",
                          color: day.getUTCDay() === 6 ? "#1a5fd6" : day.getUTCDay() === 0 ? "#d61a1a" : undefined,
                        }}
                      >
                        {day.getUTCDate()}日（{WEEKDAY_LABEL_JA[day.getUTCDay()]}）
                      </td>
                      <td
                        style={{
                          padding: "0.25rem",
                          border: "1px solid #ddd",
                          background: rowBackground,
                          verticalAlign: "top",
                        }}
                      >
                        {(() => {
                          const eventBadges = dayEvents.map((event) => (
                            <div
                              key={event.id}
                              style={{
                                fontSize: "0.85rem",
                                fontWeight: "bold",
                                marginBottom: "0.15rem",
                                background: event.store.color,
                                color: "#fff",
                                padding: "0.05rem 0.3rem",
                                borderRadius: 3,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={`${event.store.name} / ${event.name}${event.organizer ? ` / 主催: ${event.organizer}` : ""}`}
                            >
                              <EditEventDialog
                                event={{
                                  id: event.id,
                                  storeId: event.storeId,
                                  name: event.name,
                                  organizer: event.organizer,
                                  startAt: event.startAt,
                                  endAt: event.endAt,
                                }}
                                stores={stores}
                                updateAction={updateEvent}
                                deleteAction={deleteEvent}
                              >
                                📅 {showStoreName ? `(${event.store.name[0]}) ${event.name}` : event.name}
                              </EditEventDialog>
                            </div>
                          ));
                          return canWrite ? (
                            <AddEventDialog
                              date={dayKey}
                              stores={selectedStores.length ? selectedStores : stores}
                              action={createEvent}
                            >
                              {eventBadges}
                            </AddEventDialog>
                          ) : (
                            eventBadges
                          );
                        })()}
                      </td>
                      {staffList.map((staff) => {
                        const cellShifts = shiftsByStaffAndDate.get(`${staff.id}_${dayKey}`) ?? [];
                        return (
                          <td
                            key={staff.id}
                            style={{
                              padding: "0.25rem",
                              border: "1px solid #ddd",
                              background: cellShifts.length > 0 ? "#cceeff" : rowBackground,
                              verticalAlign: "top",
                            }}
                          >
                            {(() => {
                              const badges = cellShifts.map((shift) => (
                                <ShiftBadge
                                  key={shift.id}
                                  shift={{
                                    id: shift.id,
                                    startTime: shift.startTime,
                                    endTime: shift.endTime,
                                    status: shift.status,
                                    storeName: shift.store.name,
                                    storeColor: shift.store.color,
                                  }}
                                  showStore={showStoreName}
                                  updateStatusAction={updateShiftStatus}
                                  deleteAction={deleteShift}
                                />
                              ));
                              return canWrite ? (
                                <AddShiftDialog
                                  date={dayKey}
                                  stores={stores}
                                  fixedStaffId={staff.id}
                                  defaultStoreId={storeIds.length === 1 ? storeIds[0] : undefined}
                                  action={createShift}
                                >
                                  {badges}
                                </AddShiftDialog>
                              ) : (
                                badges
                              );
                            })()}
                          </td>
                        );
                      })}
                      {staffId &&
                        (() => {
                          const cellShifts = shiftsByStaffAndDate.get(`${staffId}_${dayKey}`) ?? [];
                          const total = cellShifts
                            .filter((shift) => shift.status !== "CANCELLED")
                            .reduce((sum, shift) => sum + shiftHours(shift.startTime, shift.endTime, shift.breakMinutes), 0);
                          return (
                            <td
                              style={{
                                textAlign: "right",
                                padding: "0.25rem 0.5rem",
                                border: "1px solid #ddd",
                                background: dayKey === todayKey ? "#fffbe6" : undefined,
                                fontSize: "0.8rem",
                              }}
                            >
                              {total > 0 ? `${total.toFixed(1)}時間` : ""}
                            </td>
                          );
                        })()}
                    </tr>
                  );
                })
              )}
              {staffId && staffList.length > 0 && (
                <tr>
                  <td
                    colSpan={2}
                    style={{
                      position: "sticky",
                      left: 0,
                      background: "#f5f5f5",
                      padding: "0.35rem 0.5rem",
                      border: "1px solid #ccc",
                      fontWeight: "bold",
                      fontSize: "0.8rem",
                    }}
                  >
                    合計
                  </td>
                  <td style={{ border: "1px solid #ccc", background: "#f5f5f5" }} />
                  <td
                    style={{
                      textAlign: "right",
                      padding: "0.25rem 0.5rem",
                      border: "1px solid #ccc",
                      background: "#f5f5f5",
                      fontWeight: "bold",
                      fontSize: "0.8rem",
                    }}
                  >
                    {shifts
                      .filter((shift) => shift.status !== "CANCELLED")
                      .reduce((sum, shift) => sum + shiftHours(shift.startTime, shift.endTime, shift.breakMinutes), 0)
                      .toFixed(1)}
                    時間
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
