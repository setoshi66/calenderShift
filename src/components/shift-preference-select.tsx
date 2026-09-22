"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

const PREFERENCE_OPTIONS = [
  { value: "", label: "-" },
  { value: "OK", label: "○" },
  { value: "MAYBE", label: "△" },
  { value: "NG", label: "✕" },
];

export function ShiftPreferenceSelect({
  staffId,
  date,
  value,
  action,
}: {
  staffId: string;
  date: string; // "YYYY-MM-DD"
  value: string; // "" | "OK" | "MAYBE" | "NG"
  action: (formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const formData = new FormData();
    formData.set("staffId", staffId);
    formData.set("date", date);
    formData.set("status", e.target.value);
    startTransition(async () => {
      await action(formData);
      router.refresh();
    });
  }

  return (
    <select
      defaultValue={value}
      onChange={handleChange}
      disabled={isPending}
      style={{ width: "100%", textAlign: "center", fontWeight: "bold" }}
    >
      {PREFERENCE_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function preferenceLabel(status: string | undefined | null): string {
  if (status === "OK") return "○";
  if (status === "MAYBE") return "△";
  if (status === "NG") return "✕";
  return "";
}
