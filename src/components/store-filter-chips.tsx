"use client";

import { useRouter } from "next/navigation";
import { appendStoreIdsToParams } from "@/lib/array";
import { setStoredStoreIds } from "@/lib/store-filter-actions";

type Option = { id: string; name: string; color: string };

export function StoreFilterChips({
  stores,
  storeIds,
  year,
  month,
  basePath,
  extraParams,
}: {
  stores: Option[];
  storeIds: string[];
  year: number;
  month: number;
  basePath: string;
  extraParams?: Record<string, string>;
}) {
  const router = useRouter();

  function toggle(id: string) {
    const next = storeIds.includes(id) ? storeIds.filter((x) => x !== id) : [...storeIds, id];
    const q = new URLSearchParams({ year: String(year), month: String(month), ...extraParams });
    appendStoreIdsToParams(q, next);
    setStoredStoreIds(next);
    router.push(`${basePath}?${q.toString()}`);
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
      {stores.map((store) => {
        const active = storeIds.includes(store.id);
        return (
          <button
            key={store.id}
            type="button"
            onClick={() => toggle(store.id)}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: 999,
              border: active ? `2px solid ${store.color}` : "1px solid #ccc",
              background: active ? store.color : "#fff",
              color: active ? "#fff" : "#333",
              fontSize: "0.85rem",
              fontWeight: active ? "bold" : "normal",
              minHeight: "2.2rem",
            }}
          >
            {store.name}
          </button>
        );
      })}
    </div>
  );
}
