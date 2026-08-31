"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "下書き",
  CONFIRMED: "確定",
  CANCELLED: "取消",
};

export function ShiftBadge({
  shift,
  showStore,
  updateStatusAction,
  deleteAction,
}: {
  shift: {
    id: string;
    startTime: string;
    endTime: string;
    status: string;
    storeName: string;
    storeColor: string;
  };
  showStore: boolean;
  updateStatusAction: (formData: FormData) => Promise<void>;
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

  function runAction(action: (formData: FormData) => Promise<void>, extra?: Record<string, string>) {
    const formData = new FormData();
    formData.set("id", shift.id);
    for (const [k, v] of Object.entries(extra ?? {})) formData.set(k, v);
    startTransition(async () => {
      try {
        await action(formData);
        close();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "操作に失敗しました");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        title={`${showStore ? shift.storeName + " / " : ""}${shift.startTime}-${shift.endTime} / ${STATUS_LABEL[shift.status] ?? shift.status}`}
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
        {showStore ? `(${shift.storeName[0]})` : ""}
      </button>
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        style={{ borderRadius: 8, border: "1px solid #ccc", padding: "1.25rem" }}
      >
        <div style={{ display: "grid", gap: "0.6rem", minWidth: 240 }}>
          <h3 style={{ margin: 0 }}>
            {shift.storeName} {shift.startTime}-{shift.endTime}
          </h3>
          <p style={{ margin: 0 }}>状態: {STATUS_LABEL[shift.status] ?? shift.status}</p>
          {error && <p style={{ color: "red", margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {shift.status !== "CONFIRMED" && (
              <button type="button" disabled={isPending} onClick={() => runAction(updateStatusAction, { status: "CONFIRMED" })}>
                確定
              </button>
            )}
            {shift.status !== "CANCELLED" && (
              <button type="button" disabled={isPending} onClick={() => runAction(updateStatusAction, { status: "CANCELLED" })}>
                取消
              </button>
            )}
            <button type="button" disabled={isPending} onClick={() => runAction(deleteAction)}>
              削除
            </button>
            <button type="button" onClick={close}>
              閉じる
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
