import { Loader2 } from "lucide-react";

/**
 * Jednoduchá načítací obrazovka pro `loading.tsx` (Next.js Suspense fallback).
 * Musí být lehká a synchronní, aby naskočila okamžitě — žádné `auth()`/DB.
 */
export function PageLoading({ label = "Načítání…" }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-4 py-24 text-slate-500">
      <Loader2 className="size-8 animate-spin text-slate-400" />
      <p className="mt-4 text-sm">{label}</p>
    </div>
  );
}
