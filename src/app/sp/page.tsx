import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { AddShiftDialog } from "@/components/add-shift-dialog";
import { AddEventDialog } from "@/components/add-event-dialog";
import { EditEventDialog } from "@/components/edit-event-dialog";
import { StoreFilterChips } from "@/components/store-filter-chips";
import { addDays, formatDate, jstDateKey, todayInJst, WEEKDAY_LABEL_JA } from "@/lib/date";
import { toArray } from "@/lib/array";
import { createShift } from "@/app/shifts/actions";
import { createEvent, deleteEvent, updateEvent } from "@/app/events/actions";

function monthLink(year: number, month: number, storeIds: string[]) {
  const q = new URLSearchParams({ year: String(year), month: String(month) });
  storeIds.forEach((id) => q.append("storeId", id));
  return `/sp?${q.toString()}`;
}

export default async function CalendarSpPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; storeId?: string | string[] }>;
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

  const days: Date[] = [];
  for (let d = firstOfMonth; d <= lastOfMonth; d = addDays(d, 1)) {
    days.push(d);
  }

  const [shifts, events, stores, staffList] = await Promise.all([
    prisma.shift.findMany({
      where: {
        storeId: storeIds.length ? { in: storeIds } : undefined,
        workDate: { gte: firstOfMonth, lte: lastOfMonth },
      },
      include: { staff: true, store: true },
      orderBy: [{ startTime: "asc" }],
    }),
    prisma.storeEvent.findMany({
      where: {
        storeId: storeIds.length ? { in: storeIds } : undefined,
        startAt: { gte: addDays(firstOfMonth, -1), lte: addDays(lastOfMonth, 1) },
      },
      include: { store: true },
      orderBy: [{ startAt: "asc" }],
    }),
    prisma.store.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.staff.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const shiftsByDate = new Map<string, typeof shifts>();
  for (const shift of shifts) {
    const key = formatDate(shift.workDate);
    shiftsByDate.set(key, [...(shiftsByDate.get(key) ?? []), shift]);
  }

  const eventsByDate = new Map<string, typeof events>();
  for (const event of events) {
    const key = jstDateKey(event.startAt);
    eventsByDate.set(key, [...(eventsByDate.get(key) ?? []), event]);
  }

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const todayKey = formatDate(today);

  return (
    <>
      <Nav userEmail={session?.user?.email} />
      <main style={{ padding: "1rem", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link
            href={monthLink(prevMonth.year, prevMonth.month, storeIds)}
            style={{ fontSize: "1.4rem", padding: "0.4rem 0.7rem" }}
          >
            ‹
          </Link>
          <strong style={{ fontSize: "1.1rem" }}>
            {year}年{month}月
          </strong>
          <Link
            href={monthLink(nextMonth.year, nextMonth.month, storeIds)}
            style={{ fontSize: "1.4rem", padding: "0.4rem 0.7rem" }}
          >
            ›
          </Link>
        </div>

        {year === today.getUTCFullYear() && month === today.getUTCMonth() + 1 && (
          <div style={{ textAlign: "center", marginTop: "0.25rem" }}>
            <a href={`#day-${todayKey}`} style={{ fontSize: "0.8rem", color: "#0969da" }}>
              今日へ移動
            </a>
          </div>
        )}

        <div style={{ marginTop: "0.75rem" }}>
          <StoreFilterChips stores={stores} storeIds={storeIds} year={year} month={month} basePath="/sp" />
        </div>

        <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {days.map((day) => {
            const key = formatDate(day);
            const isToday = key === todayKey;
            const dayEvents = eventsByDate.get(key) ?? [];
            const dayShifts = shiftsByDate.get(key) ?? [];
            const weekday = day.getUTCDay();
            const dateColor = weekday === 6 ? "#1a5fd6" : weekday === 0 ? "#d61a1a" : undefined;

            return (
              <div
                key={key}
                id={`day-${key}`}
                style={{
                  border: isToday ? "2px solid #f0c419" : "1px solid #ddd",
                  borderRadius: 8,
                  padding: "0.75rem",
                  background: isToday ? "#fffbe6" : "#fff",
                  scrollMarginTop: "1rem",
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "0.35rem" }}>
                  <span style={{ fontWeight: "bold", color: dateColor, flexShrink: 0 }}>
                    {day.getUTCDate()}日（{WEEKDAY_LABEL_JA[weekday]}）
                  </span>
                  {canWrite && (
                    <div style={{ display: "flex", gap: "0.75rem", flexShrink: 0 }}>
                      <AddShiftDialog
                        date={key}
                        stores={stores}
                        staffList={staffList}
                        action={createShift}
                        label={<span style={{ fontSize: "0.8rem", color: "#0969da", whiteSpace: "nowrap" }}>＋ シフト</span>}
                      />
                      <AddEventDialog
                        date={key}
                        stores={stores}
                        action={createEvent}
                        label={<span style={{ fontSize: "0.8rem", color: "#0969da", whiteSpace: "nowrap" }}>＋ イベント</span>}
                      />
                    </div>
                  )}
                </div>

                <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      style={{
                        background: event.store.color,
                        color: "#fff",
                        borderRadius: 4,
                        padding: "0.35rem 0.5rem",
                        fontSize: "0.85rem",
                        fontWeight: "bold",
                      }}
                    >
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
                          📅 {showStoreName ? `(${event.store.name[0]}) ${event.name}` : event.name}
                        </EditEventDialog>
                      ) : (
                        <>📅 {showStoreName ? `(${event.store.name[0]}) ${event.name}` : event.name}</>
                      )}
                    </div>
                  ))}

                  {dayShifts.map((shift) => (
                    <div
                      key={shift.id}
                      style={{
                        background: shift.store.color,
                        color: "#fff",
                        borderRadius: 4,
                        padding: "0.35rem 0.5rem",
                        fontSize: "0.85rem",
                        opacity: shift.status === "CANCELLED" ? 0.55 : shift.status === "DRAFT" ? 0.75 : 1,
                        textDecoration: shift.status === "CANCELLED" ? "line-through" : "none",
                      }}
                    >
                      {shift.startTime}-{shift.endTime} {shift.staff.name}
                      {showStoreName && `(${shift.store.name[0]})`}
                    </div>
                  ))}

                  {dayEvents.length === 0 && dayShifts.length === 0 && (
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
