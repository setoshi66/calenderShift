"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { utcToJstDatetimeLocal } from "@/lib/date";

type Option = { id: string; name: string };

const fieldCaptionStyle = {
  display: "block",
  fontSize: "0.8rem",
  color: "#666",
  marginBottom: "0.25rem",
} as const;

export function EditEventDialog({
  event,
  stores,
  updateAction,
  deleteAction,
  children,
}: {
  event: {
    id: string;
    storeId: string;
    name: string;
    organizer: string | null;
    startAt: Date;
    endAt: Date;
  };
  stores: Option[];
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  children: ReactNode;
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
    if (!confirm(`「${event.name}」を削除しますか？`)) return;
    const formData = new FormData();
    formData.set("id", event.id);
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
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          padding: 0,
          margin: 0,
          border: "none",
          background: "none",
          font: "inherit",
          color: "inherit",
          cursor: "pointer",
        }}
      >
        {children}
      </button>
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        style={{ borderRadius: 8, border: "1px solid #ccc", padding: "1.25rem" }}
      >
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.9rem", minWidth: 320 }}>
          <h3 style={{ margin: 0, paddingBottom: "0.5rem", borderBottom: "1px solid #eee" }}>イベントを編集</h3>
          <input type="hidden" name="id" value={event.id} />
          <label style={{ display: "block" }}>
            <span style={fieldCaptionStyle}>店舗 *</span>
            <select name="storeId" required defaultValue={event.storeId} style={{ width: "100%" }}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "block" }}>
            <span style={fieldCaptionStyle}>イベント名 *</span>
            <input type="text" name="name" required defaultValue={event.name} style={{ width: "100%" }} />
          </label>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <label style={{ flex: 1, display: "block" }}>
              <span style={fieldCaptionStyle}>開始 *</span>
              <input
                type="datetime-local"
                name="startAt"
                required
                defaultValue={utcToJstDatetimeLocal(event.startAt)}
                style={{ width: "100%" }}
              />
            </label>
            <label style={{ flex: 1, display: "block" }}>
              <span style={fieldCaptionStyle}>終了 *</span>
              <input
                type="datetime-local"
                name="endAt"
                required
                defaultValue={utcToJstDatetimeLocal(event.endAt)}
                style={{ width: "100%" }}
              />
            </label>
          </div>
          <label style={{ display: "block" }}>
            <span style={fieldCaptionStyle}>主催</span>
            <input type="text" name="organizer" defaultValue={event.organizer ?? ""} style={{ width: "100%" }} />
          </label>
          {error && <p style={{ color: "red", margin: 0 }}>{error}</p>}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "0.5rem",
              paddingTop: "0.5rem",
              borderTop: "1px solid #eee",
            }}
          >
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
