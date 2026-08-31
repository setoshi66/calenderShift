"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; name: string };

export function ShiftBadge({
  shift,
  stores,
  staffList,
  showStore,
  updateAction,
  deleteAction,
}: {
  shift: {
    id: string;
    staffId: string;
    storeId: string;
    workDate: string; // "YYYY-MM-DD"
    startTime: string;
    endTime: string;
    breakMinutes: number;
    status: string;
    note: string | null;
    storeName: string;
    storeColor: string;
    staffName?: string;
  };
  stores: Option[];
  staffList: Option[];
  showStore: boolean;
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function open() {
    setError(null);
    dialogRef.current?.showModal();
  }
  function close() {
    dialogRef.current?.close();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateAction(formData);
        close();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "更新に失敗しました");
      }
    });
  }

  function handleDelete() {
    if (!confirm("このシフトを削除しますか？")) return;
    const formData = new FormData();
    formData.set("id", shift.id);
    startTransition(async () => {
      try {
        await deleteAction(formData);
        close();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "削除に失敗しました");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        title={`${showStore ? shift.storeName + " / " : ""}${shift.startTime}-${shift.endTime}`}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          fontSize: "0.85rem",
          padding: "0.05rem 0.3rem",
          marginBottom: "0.15rem",
          border: "none",
          borderRadius: 3,
          background: shift.storeColor,
          color: "#fff",
          opacity: shift.status === "CANCELLED" ? 0.55 : shift.status === "DRAFT" ? 0.75 : 1,
          textDecoration: shift.status === "CANCELLED" ? "line-through" : "none",
          cursor: "pointer",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {shift.startTime}
        {shift.staffName ? ` ${shift.staffName}` : ""}
        {showStore ? `(${shift.storeName[0]})` : ""}
      </button>
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        style={{ borderRadius: 8, border: "1px solid #ccc", padding: "1.25rem" }}
      >
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.6rem", minWidth: 280 }}>
          <h3 style={{ margin: 0 }}>シフトを編集</h3>
          <input type="hidden" name="id" value={shift.id} />
          <label>
            店舗 *
            <select name="storeId" required defaultValue={shift.storeId} style={{ width: "100%" }}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            スタッフ *
            <select name="staffId" required defaultValue={shift.staffId} style={{ width: "100%" }}>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            日付 *
            <input type="date" name="workDate" required defaultValue={shift.workDate} style={{ width: "100%" }} />
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <label style={{ flex: 1 }}>
              開始 *
              <input type="time" name="startTime" required defaultValue={shift.startTime} style={{ width: "100%" }} />
            </label>
            <label style={{ flex: 1 }}>
              終了 *
              <input type="time" name="endTime" required defaultValue={shift.endTime} style={{ width: "100%" }} />
            </label>
          </div>
          <label>
            休憩（分）
            <input type="number" name="breakMinutes" min={0} defaultValue={shift.breakMinutes} style={{ width: "100%" }} />
          </label>
          <label>
            状態
            <select name="status" defaultValue={shift.status} style={{ width: "100%" }}>
              <option value="DRAFT">下書き</option>
              <option value="CONFIRMED">確定（Googleカレンダーへ即反映）</option>
              <option value="CANCELLED">取消</option>
            </select>
          </label>
          <label>
            メモ
            <input type="text" name="note" defaultValue={shift.note ?? ""} style={{ width: "100%" }} />
          </label>
          {error && <p style={{ color: "red", margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
            <button type="button" onClick={handleDelete} disabled={isPending}>
              削除
            </button>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" onClick={close}>
                キャンセル
              </button>
              <button type="submit" disabled={isPending}>
                {isPending ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
