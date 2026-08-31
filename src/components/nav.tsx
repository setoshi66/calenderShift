"use client";

import { useState } from "react";
import Link from "next/link";
import { signOutAction } from "@/lib/auth-actions";
import { ViewModeToggle } from "@/components/view-mode-toggle";
import type { ViewMode } from "@/lib/view-mode";

const LINKS = [
  { href: "/", label: "カレンダー" },
  { href: "/shifts", label: "シフト" },
  { href: "/sales", label: "売上" },
  { href: "/stores", label: "店舗" },
  { href: "/staff", label: "スタッフ" },
];

export function Nav({
  userEmail,
  viewMode,
  title,
}: {
  userEmail?: string | null;
  viewMode: ViewMode;
  title?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <nav
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.75rem 2rem",
        borderBottom: "1px solid #ddd",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="メニュー"
        style={{ fontSize: "1.2rem", lineHeight: 1, padding: "0.25rem 0.6rem", flexShrink: 0 }}
      >
        ☰
      </button>

      {title && (
        <strong
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: "1rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </strong>
      )}

      <div style={{ flexShrink: 0, marginLeft: title ? 0 : "auto" }}>
        <ViewModeToggle mode={viewMode} />
      </div>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9 }} />
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: "2rem",
              marginTop: "0.25rem",
              background: "#fff",
              border: "1px solid #ccc",
              borderRadius: 6,
              padding: "0.75rem",
              minWidth: 220,
              zIndex: 10,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {LINKS.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                  {link.label}
                </Link>
              ))}
            </div>
            <hr style={{ margin: "0.75rem 0" }} />
            <div style={{ fontSize: "0.85rem", color: "#555", marginBottom: "0.5rem" }}>{userEmail}</div>
            <form action={signOutAction}>
              <button type="submit">ログアウト</button>
            </form>
          </div>
        </>
      )}
    </nav>
  );
}
