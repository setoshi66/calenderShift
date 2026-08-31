import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { AddShiftDialog } from "@/components/add-shift-dialog";
import { AddEventDialog } from "@/components/add-event-dialog";
import { EditEventDialog } from "@/components/edit-event-dialog";
import { ShiftBadge } from "@/components/shift-badge";
import { StoreFilterChips } from "@/components/store-filter-chips";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { addDays, formatDate, jstDateKey, shiftHours, todayInJst, WEEKDAY_LABEL_JA } from "@/lib/date";
import { toArray } from "@/lib/array";
import { createShift, deleteShift, updateShiftStatus } from "../actions";
import { createEvent, deleteEvent, updateEvent } from "@/app/events/actions";

function monthLink(year: number, month: number, storeIds: string[], staffId: string | undefined) {
  const q = new URLSearchParams({ year: String(year), month: String(month) });
  storeIds.forEach((id) => q.append("storeId", id));
  if (staffId) q.set("staffId", staffId);
  return `/shifts/sp?${q.toString()}`;
}

export default async function ShiftsSpPage({
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
      include: { store: true, staff: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.store.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    storeIds.length === 1
      ? prisma.storeEvent.findMany({
          where: { storeId: storeIds[0], startAt: { gte: addDays(firstOfMonth, -1), lte: addDays(lastOfMonth, 1) } },
          include: { store: true },
          orderBy: { startAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const shiftsByDate = new Map<string, typeof shifts>();
  for (const shift of shifts) {
    const key = formatDate(shift.workDate);
    shiftsByDate.set(key, [...(shiftsByDate.get(key) ?? []), shift]);
  }
  const eventsByDate = new Map<string, typeof storeEvents>();
  for (const event of storeEvents) {
    const key = jstDateKey(event.startAt);
    eventsByDate.set(key, [...(eventsByDate.get(key) ?? []), event]);
  }

  const selectedStores = stores.filter((s) => storeIds.includes(s.id));
  const monthlyHours = staffId
    ? shifts.filter((s) => s.status !== "CANCELLED").reduce((sum, s) => sum + shiftHours(s.startTime, s.endTime, s.breakMinutes), 0)
    : null;

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const todayKey = formatDate(today);

  return (
    <>
      <Nav userEmail={session?.user?.email} />
      <main style={{ padding: "1rem", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href={monthLink(prevMonth.year, prevMonth.month, storeIds, staffId)} style={{ fontSize: "1.4rem", padding: "0.4rem 0.7rem" }}>
            ‹
          </Link>
          <strong style={{ fontSize: "1.1rem" }}>
            {year}年{month}月
          </strong>
          <Link href={monthLink(nextMonth.year, nextMonth.month, storeIds, staffId)} style={{ fontSize: "1.4rem", padding: "0.4rem 0.7rem" }}>
            ›
          </Link>
        </div>

        <div style={{ marginTop: "0.75rem" }}>
          <StoreFilterChips
            stores={stores}
            storeIds={storeIds}
            year={year}
            month={month}
            basePath="/shifts/sp"
            extraParams={staffId ? { staffId } : undefined}
          />
        </div>

        <div style={{ marginTop: "0.5rem" }}>
          <AutoSubmitSelect
            name="staffId"
            value={staffId ?? ""}
            options={staffList}
            allLabel="スタッフ: すべて"
            basePath="/shifts/sp"
            extraParams={{ year: String(year), month: String(month) }}
            storeIds={storeIds}
          />
        </div>

        {monthlyHours !== null && (
          <div style={{ marginTop: "0.5rem", fontSize: "0.9rem", textAlign: "right" }}>
            今月の勤務時間合計: <strong>{monthlyHours.toFixed(1)}時間</strong>
          </div>
        )}

        <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {days.map((day) => {
            const key = formatDate(day);
            const isToday = key === todayKey;
            const dayShifts = shiftsByDate.get(key) ?? [];
            const dayEvents = eventsByDate.get(key) ?? [];
            const weekday = day.getUTCDay();
            const dateColor = weekday === 6 ? "#1a5fd6" : weekday === 0 ? "#d61a1a" : undefined;
            const dayHours = dayShifts
              .filter((s) => s.status !== "CANCELLED")
              .reduce((sum, s) => sum + shiftHours(s.startTime, s.endTime, s.breakMinutes), 0);

            return (
              <div
                key={key}
                style={{
                  border: isToday ? "2px solid #f0c419" : "1px solid #ddd",
                  borderRadius: 8,
                  padding: "0.75rem",
                  background: isToday ? "#fffbe6" : "#fff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: "bold", color: dateColor }}>
                    {day.getUTCDate()}日（{WEEKDAY_LABEL_JA[weekday]}）
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    {staffId && dayHours > 0 && <span style={{ fontSize: "0.8rem", color: "#666" }}>{dayHours.toFixed(1)}時間</span>}
                    {canWrite && (
                      <>
                        <AddShiftDialog
                          date={key}
                          stores={stores}
                          staffList={staffList}
                          defaultStoreId={storeIds.length === 1 ? storeIds[0] : undefined}
                          action={createShift}
                          label={<span style={{ fontSize: "0.8rem", color: "#0969da" }}>＋ シフト</span>}
                        />
                        {storeIds.length === 1 && (
                          <AddEventDialog
                            date={key}
                            stores={selectedStores}
                            action={createEvent}
                            label={<span style={{ fontSize: "0.8rem", color: "#0969da" }}>＋ イベント</span>}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {storeIds.length === 1 &&
                    dayEvents.map((event) => (
                      <div key={event.id} style={{ background: event.store.color, color: "#fff", borderRadius: 4, padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontWeight: "bold" }}>
                        {canWrite ? (
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
                            📅 {event.name}
                          </EditEventDialog>
                        ) : (
                          <>📅 {event.name}</>
                        )}
                      </div>
                    ))}

                  {dayShifts.map((shift) => (
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
                  ))}

                  {dayShifts.length === 0 && dayEvents.length === 0 && (
                    <span style={{ fontSize: "0.85rem", color: "#bbb" }}>予定なし</span>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
