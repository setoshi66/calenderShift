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
import { appendStoreIdsToParams, resolveStoreIds } from "@/lib/array";
import { getViewMode } from "@/lib/view-mode";
import { getStoredStoreIds } from "@/lib/store-filter";
import { createShift, deleteShift, updateShift } from "./actions";
import { createEvent, deleteEvent, updateEvent } from "@/app/events/actions";

function monthLink(year: number, month: number, storeIds: string[], staffId: string | undefined) {
  const q = new URLSearchParams({ year: String(year), month: String(month) });
  appendStoreIdsToParams(q, storeIds);
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
  const viewMode = await getViewMode();

  const year = Number(params.year) || today.getUTCFullYear();
  const month = Number(params.month) || today.getUTCMonth() + 1; // 1-12
  const staffId = params.staffId || undefined;

  const [stores, storedStoreIds] = await Promise.all([
    prisma.store.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    getStoredStoreIds(),
  ]);
  const storeIds = resolveStoreIds(params.storeId, storedStoreIds, stores.map((s) => s.id));
  const showStoreName = storeIds.length !== 1;

  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const lastOfMonth = new Date(Date.UTC(year, month, 0));
  const days: Date[] = [];
  for (let d = firstOfMonth; d <= lastOfMonth; d = addDays(d, 1)) {
    days.push(d);
  }

  const [allStaff, columnStaff, shifts, storeEvents] = await Promise.all([
    // 店舗のみで絞り込んだスタッフ一覧（絞り込みセレクトの選択肢・編集ダイアログのスタッフ選択に使用）
    prisma.staff.findMany({
      where: {
        isActive: true,
        storeAssignments: { some: { storeId: { in: storeIds } } },
      },
      orderBy: { name: "asc" },
    }),
    // スタッフ絞り込みも反映した一覧（PC版のマトリクス列に使用）
    prisma.staff.findMany({
      where: {
        isActive: true,
        id: staffId,
        storeAssignments: { some: { storeId: { in: storeIds } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.shift.findMany({
      where: {
        storeId: { in: storeIds },
        staffId,
        workDate: { gte: firstOfMonth, lte: lastOfMonth },
      },
      include: { store: true, staff: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.storeEvent.findMany({
      where: {
        storeId: { in: storeIds },
        startAt: { gte: addDays(firstOfMonth, -1), lte: addDays(lastOfMonth, 1) },
      },
      include: { store: true },
      orderBy: { startAt: "asc" },
    }),
  ]);

  const shiftsByDate = new Map<string, typeof shifts>();
  const shiftsByStaffAndDate = new Map<string, typeof shifts>();
  for (const shift of shifts) {
    const dateKey = formatDate(shift.workDate);
    shiftsByDate.set(dateKey, [...(shiftsByDate.get(dateKey) ?? []), shift]);
    const key = `${shift.staffId}_${dateKey}`;
    shiftsByStaffAndDate.set(key, [...(shiftsByStaffAndDate.get(key) ?? []), shift]);
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

  if (viewMode === "sp") {
    return (
      <>
        <Nav userEmail={session?.user?.email} viewMode={viewMode} title="シフト" />
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
              basePath="/shifts"
              extraParams={staffId ? { staffId } : undefined}
            />
          </div>

          <div style={{ marginTop: "0.5rem" }}>
            <AutoSubmitSelect
              name="staffId"
              value={staffId ?? ""}
              options={allStaff}
              allLabel="スタッフ: すべて"
              basePath="/shifts"
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
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "0.35rem" }}>
                    <span style={{ fontWeight: "bold", color: dateColor, flexShrink: 0 }}>
                      {day.getUTCDate()}日（{WEEKDAY_LABEL_JA[weekday]}）
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                      {staffId && dayHours > 0 && (
                        <span style={{ fontSize: "0.8rem", color: "#666", whiteSpace: "nowrap" }}>{dayHours.toFixed(1)}時間</span>
                      )}
                      {canWrite && (
                        <>
                          <AddShiftDialog
                            date={key}
                            stores={stores}
                            staffList={allStaff}
                            defaultStoreId={storeIds.length === 1 ? storeIds[0] : undefined}
                            action={createShift}
                            label={<span style={{ fontSize: "0.8rem", color: "#0969da", whiteSpace: "nowrap" }}>＋ シフト</span>}
                          />
                          {storeIds.length === 1 && (
                            <AddEventDialog
                              date={key}
                              stores={selectedStores}
                              defaultStoreId={storeIds[0]}
                              action={createEvent}
                              label={<span style={{ fontSize: "0.8rem", color: "#0969da", whiteSpace: "nowrap" }}>＋ イベント</span>}
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
                          staffId: shift.staffId,
                          storeId: shift.storeId,
                          workDate: formatDate(shift.workDate),
                          startTime: shift.startTime,
                          endTime: shift.endTime,
                          breakMinutes: shift.breakMinutes,
                          status: shift.status,
                          note: shift.note,
                          storeName: shift.store.name,
                          storeColor: shift.store.color,
                          staffName: shift.staff.name,
                        }}
                        stores={stores}
                        staffList={allStaff}
                        showStore={showStoreName}
                        updateAction={updateShift}
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

  return (
    <>
      <Nav userEmail={session?.user?.email} viewMode={viewMode} title="シフト" />
      <main style={{ padding: "2rem", maxWidth: "100%", margin: "0 auto" }}>
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

        <div style={{ marginTop: "0.75rem", maxWidth: 280 }}>
          <AutoSubmitSelect
            name="staffId"
            value={staffId ?? ""}
            options={allStaff}
            allLabel="スタッフ: すべて"
            basePath="/shifts"
            extraParams={{ year: String(year), month: String(month) }}
            storeIds={storeIds}
          />
        </div>

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
                {columnStaff.length === 0 ? (
                  <th style={{ border: "1px solid #ccc", background: "#f5f5f5" }} />
                ) : (
                  columnStaff.map((staff) => (
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
              {columnStaff.length === 0 ? (
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
                              defaultStoreId={storeIds.length === 1 ? storeIds[0] : undefined}
                              action={createEvent}
                            >
                              {eventBadges}
                            </AddEventDialog>
                          ) : (
                            eventBadges
                          );
                        })()}
                      </td>
                      {columnStaff.map((staff) => {
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
                                    staffId: shift.staffId,
                                    storeId: shift.storeId,
                                    workDate: formatDate(shift.workDate),
                                    startTime: shift.startTime,
                                    endTime: shift.endTime,
                                    breakMinutes: shift.breakMinutes,
                                    status: shift.status,
                                    note: shift.note,
                                    storeName: shift.store.name,
                                    storeColor: shift.store.color,
                                  }}
                                  stores={stores}
                                  staffList={allStaff}
                                  showStore={showStoreName}
                                  updateAction={updateShift}
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
              {staffId && columnStaff.length > 0 && (
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
