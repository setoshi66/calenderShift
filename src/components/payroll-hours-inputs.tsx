"use client";

import { useState } from "react";
import { tdStyle } from "@/lib/table-styles";

// 「勤務時間(合計)」は初期値・既定値としてシフト+追加に自動で追従するが、直接編集も可能。
// 追加時間が変わるたびに合計を再計算して上書きする一方、合計欄自体への直接入力はそのまま保持する。
export function PayrollHoursInputs({
  staffId,
  shiftHours,
  defaultExtraHours,
  defaultTotalHours,
}: {
  staffId: string;
  shiftHours: number;
  defaultExtraHours: number;
  defaultTotalHours: number;
}) {
  const [totalHours, setTotalHours] = useState(defaultTotalHours);

  return (
    <>
      <td style={tdStyle}>
        <input
          type="number"
          step="0.1"
          name={`extraHours_${staffId}`}
          defaultValue={defaultExtraHours}
          onChange={(e) => setTotalHours(Math.round((shiftHours + (Number(e.target.value) || 0)) * 10) / 10)}
          style={{ width: "100%", textAlign: "right" }}
        />
      </td>
      <td style={tdStyle}>
        <input
          type="number"
          step="0.1"
          name={`totalHours_${staffId}`}
          value={totalHours}
          onChange={(e) => setTotalHours(Number(e.target.value) || 0)}
          style={{ width: "100%", textAlign: "right" }}
        />
      </td>
    </>
  );
}
