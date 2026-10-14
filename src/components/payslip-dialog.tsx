"use client";

import { useRef } from "react";

function yen(n: number) {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function PayslipDialog({
  staffName,
  year,
  month,
  shiftHoursTotal,
  extraHours,
  totalHours,
  hourlyWage,
  workPay,
  commission1,
  commission2,
  commission3,
  commission4,
  deduction,
  totalPay,
}: {
  staffName: string;
  year: number;
  month: number;
  shiftHoursTotal: number;
  extraHours: number;
  totalHours: number;
  hourlyWage: number | null;
  workPay: number;
  commission1: number;
  commission2: number;
  commission3: number;
  commission4: number;
  deduction: number;
  totalPay: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function open() {
    dialogRef.current?.showModal();
  }
  function close() {
    dialogRef.current?.close();
  }

  const rowStyle = { display: "flex", justifyContent: "space-between", padding: "0.3rem 0", borderBottom: "1px solid #eee" };

  return (
    <>
      <button type="button" onClick={open}>
        給与明細
      </button>
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        style={{ borderRadius: 8, border: "1px solid #ccc", padding: "1.5rem" }}
      >
        <div style={{ minWidth: 320 }}>
          <h3 style={{ margin: 0 }}>給与明細</h3>
          <p style={{ margin: "0.5rem 0 1rem", color: "#555" }}>
            {staffName} 様　/　{year}年{month}月分
          </p>

          <div style={rowStyle}>
            <span>勤務時間(シフト)</span>
            <span>{shiftHoursTotal.toFixed(1)}時間</span>
          </div>
          <div style={rowStyle}>
            <span>勤務時間(追加)</span>
            <span>{extraHours.toFixed(1)}時間</span>
          </div>
          <div style={rowStyle}>
            <span>勤務時間(合計)</span>
            <span>{totalHours.toFixed(1)}時間</span>
          </div>
          <div style={rowStyle}>
            <span>時給</span>
            <span>{hourlyWage != null ? yen(hourlyWage) : "未設定"}</span>
          </div>
          <div style={{ ...rowStyle, fontWeight: "bold" }}>
            <span>勤務報酬</span>
            <span>{yen(workPay)}</span>
          </div>

          <div style={rowStyle}>
            <span>歩合1</span>
            <span>{yen(commission1)}</span>
          </div>
          <div style={rowStyle}>
            <span>歩合2</span>
            <span>{yen(commission2)}</span>
          </div>
          <div style={rowStyle}>
            <span>歩合3</span>
            <span>{yen(commission3)}</span>
          </div>
          <div style={rowStyle}>
            <span>歩合4</span>
            <span>{yen(commission4)}</span>
          </div>
          <div style={rowStyle}>
            <span>控除</span>
            <span>-{yen(deduction)}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0", marginTop: "0.3rem", borderTop: "2px solid #333", fontWeight: "bold", fontSize: "1.1rem" }}>
            <span>報酬合計</span>
            <span>{yen(totalPay)}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem" }}>
            <button type="button" onClick={close}>
              閉じる
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
