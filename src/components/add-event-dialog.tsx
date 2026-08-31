"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; name: string };

export function AddEventDialog({
  date,
  stores,
  action,
  children,
}: {
  date: string;
  stores: Option[];
  action: (formData: FormData) => Promise<void>;
  children?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
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
        await action(formData);
        close();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "登録に失敗しました");
      }
    });
  }

  return (
    <>
      {children ? (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) open();
          }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          title="クリックしてイベントを追加"
          style={{
            minHeight: "1.4rem",
            cursor: "pointer",
            borderRadius: 4,
            background: hover ? "#eef4ff" : undefined,
          }}
        >
          {children}
        </div>
      ) : (
        <button
          type="button"
          onClick={open}
          title="イベントを追加"
          style={{
            fontSize: "0.8rem",
            lineHeight: 1,
            padding: "0.1rem 0.4rem",
            flexShrink: 0,
          }}
        >
          📅+
        </button>
      )}
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        style={{ borderRadius: 8, border: "1px solid #ccc", padding: "1.25rem" }}
      >
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.6rem", minWidth: 280 }}>
          <h3 style={{ margin: 0 }}>{date} のイベントを登録</h3>
          <label>
            店舗 *
            <select name="storeId" required style={{ width: "100%" }}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            イベント名 *
            <input type="text" name="name" required style={{ width: "100%" }} />
          </label>
          <label>
            主催
            <input type="text" name="organizer" style={{ width: "100%" }} />
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <label style={{ flex: 1 }}>
              開始 *
              <input
                type="datetime-local"
                name="startAt"
                required
                defaultValue={`${date}T18:00`}
                style={{ width: "100%" }}
              />
            </label>
            <label style={{ flex: 1 }}>
              終了 *
              <input
                type="datetime-local"
                name="endAt"
                required
                defaultValue={`${date}T23:00`}
                style={{ width: "100%" }}
              />
            </label>
          </div>
          {error && <p style={{ color: "red", margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button type="button" onClick={close}>
              キャンセル
            </button>
            <button type="submit" disabled={isPending}>
              {isPending ? "登録中..." : "登録"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
