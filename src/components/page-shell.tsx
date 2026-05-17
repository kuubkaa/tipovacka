import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { tournament } from "@/config/tournament";

export function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="size-4" />
            {tournament.shortName}
          </Link>
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Tipovací liga
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-2 text-base text-slate-600">{description}</p>
        )}
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
