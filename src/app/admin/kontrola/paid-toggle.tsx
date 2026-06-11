"use client";

import { useState, useTransition } from "react";

import { setUserPaidAction } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

/**
 * Přepínač zaplaceno/nezaplaceno pro jednoho tipéra.
 * Optimisticky překreslí a v pozadí volá server akci; při chybě se vrátí zpět.
 */
export function PaidToggle({
  userId,
  initialPaid,
}: {
  userId: string;
  initialPaid: boolean;
}) {
  const [paid, setPaid] = useState(initialPaid);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !paid;
    setPaid(next);
    startTransition(async () => {
      const res = await setUserPaidAction(userId, next);
      if (res.status !== "ok") {
        setPaid(!next); // revert
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      role="switch"
      aria-checked={paid}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-50",
        paid
          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
      )}
    >
      <span
        className={cn(
          "inline-block h-2 w-2 rounded-full",
          paid ? "bg-emerald-500" : "bg-slate-400"
        )}
      />
      {paid ? "Zaplaceno" : "Nezaplaceno"}
    </button>
  );
}
