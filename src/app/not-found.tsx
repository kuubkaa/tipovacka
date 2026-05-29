import Link from "next/link";
import { Compass } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 404 stránka — zobrazí se pro neexistující URL místo holé výchozí
 * hlášky Next.js.
 */
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-6 py-16 text-center text-slate-900">
      <div className="flex size-12 items-center justify-center rounded-full bg-slate-200 text-slate-600">
        <Compass className="size-6" />
      </div>
      <h1 className="mt-5 text-2xl font-bold tracking-tight">
        Stránka nenalezena
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate-600">
        Tahle adresa neexistuje nebo už byla přesunuta.
      </p>
      <Link
        href="/"
        className={cn(
          buttonVariants(),
          "mt-6 h-10 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800"
        )}
      >
        Zpět na úvod
      </Link>
    </div>
  );
}
