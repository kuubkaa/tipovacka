"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Route-level error boundary. Zachytí neočekávané chyby při renderu
 * stránek (např. výpadek DB při načítání dat) a místo prázdné/rozbité
 * obrazovky nabídne uživateli zkusit to znovu nebo zpět na úvod.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route error]", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-6 py-16 text-center text-slate-900">
      <div className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <AlertTriangle className="size-6" />
      </div>
      <h1 className="mt-5 text-2xl font-bold tracking-tight">
        Něco se pokazilo
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate-600">
        Stránku se nepodařilo načíst. Zkus to prosím znovu — pokud problém
        přetrvává, dej vědět adminovi.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button
          onClick={reset}
          className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Zkusit znovu
        </Button>
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-10 rounded-lg px-5 text-sm font-medium"
          )}
        >
          Zpět na úvod
        </Link>
      </div>
    </div>
  );
}
