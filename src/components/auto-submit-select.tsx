"use client";

import { useRouter } from "next/navigation";
import { appendStoreIdsToParams } from "@/lib/array";

export function AutoSubmitSelect({
  name,
  value,
  options,
  allLabel,
  basePath,
  extraParams,
  storeIds,
}: {
  name: string;
  value: string;
  options: { id: string; name: string }[];
  allLabel: string;
  basePath: string;
  extraParams: Record<string, string>;
  storeIds?: string[];
}) {
  const router = useRouter();

  return (
    <select
      defaultValue={value}
      onChange={(e) => {
        const q = new URLSearchParams(extraParams);
        if (storeIds) appendStoreIdsToParams(q, storeIds);
        if (e.target.value) q.set(name, e.target.value);
        router.push(`${basePath}?${q.toString()}`);
      }}
      style={{ width: "100%" }}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
