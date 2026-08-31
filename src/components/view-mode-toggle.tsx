"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setViewMode } from "@/lib/view-mode-actions";
import type { ViewMode } from "@/lib/view-mode";

export function ViewModeToggle({ mode }: { mode: ViewMode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isSp = mode === "sp";

  function toggle() {
    startTransition(async () => {
      await setViewMode(isSp ? "pc" : "sp");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      title={isSp ? "PC表示に切り替え" : "スマホ表示に切り替え"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.4rem",
        border: "none",
        background: "none",
        cursor: "pointer",
        padding: 0,
        opacity: isPending ? 0.6 : 1,
      }}
    >
      <span style={{ fontSize: "0.8rem" }}>{isSp ? "📱 スマホ表示" : "🖥 PC表示"}</span>
      <span
        aria-hidden
        style={{
          position: "relative",
          display: "inline-block",
          width: "2.4rem",
          height: "1.4rem",
          borderRadius: 999,
          background: isSp ? "#0969da" : "#ccc",
          transition: "background 0.15s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "0.15rem",
            left: isSp ? "1.15rem" : "0.15rem",
            width: "1.1rem",
            height: "1.1rem",
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.15s",
            boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
          }}
        />
      </span>
    </button>
  );
}
