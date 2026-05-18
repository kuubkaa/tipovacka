"use client";

import { Download, Printer } from "lucide-react";

interface Column {
  key: string;
  short: string;
  sub?: string;
  real: string;
}

interface Row {
  userId: string;
  name: string;
  isMe: boolean;
  cells: Array<{ key: string; text: string; points: number }>;
  total: number;
}

export function OverviewClient({
  columns,
  rows,
}: {
  columns: Column[];
  rows: Row[];
}) {
  function downloadCsv() {
    const header = ["Tipér", ...columns.map((c) => `${c.short}${c.sub ? " (" + c.sub + ")" : ""}`), "Body"];
    const realRow = ["Skutečně", ...columns.map((c) => c.real), ""];
    const dataRows = rows.map((r) => [
      r.name,
      ...r.cells.map((c) => c.text),
      r.total.toString(),
    ]);
    const all = [header, realRow, ...dataRows];

    const csv = all
      .map((row) =>
        row
          .map((cell) => {
            const s = cell ?? "";
            // Escape: pokud obsahuje čárku/uvozovky/newline, obal uvozovkami
            if (/[",\n]/.test(s)) {
              return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
          })
          .join(",")
      )
      .join("\n");

    // BOM pro správné kódování diakritiky v Excelu
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tipovacka-prehled-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={downloadCsv}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-300 transition-colors hover:bg-slate-100"
      >
        <Download className="size-3.5" />
        CSV
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-300 transition-colors hover:bg-slate-100"
      >
        <Printer className="size-3.5" />
        Tisk
      </button>
    </div>
  );
}
