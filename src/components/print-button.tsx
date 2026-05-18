"use client";

import { Printer } from "lucide-react";

import { cn } from "@/lib/utils";

export function PrintButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-300 transition-colors hover:bg-slate-100 print:hidden",
        className
      )}
    >
      <Printer className="size-3.5" />
      Vytisknout
    </button>
  );
}
