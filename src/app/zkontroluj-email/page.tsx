import Link from "next/link";
import { MailCheck } from "lucide-react";

import { tournament } from "@/config/tournament";

export default function ZkontrolujEmailPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
          >
            {tournament.shortName}
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <MailCheck className="size-7" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
            Zkontroluj email
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Pokud je tvůj email v naší tipovačce, poslali jsme ti přihlašovací
            odkaz. Klikni v něm na tlačítko a budeš přihlášen.
          </p>

          <div className="mt-6 rounded-md bg-slate-50 p-3 text-left text-xs text-slate-600">
            <p className="font-medium text-slate-700">Nevidíš email?</p>
            <ul className="mt-1.5 list-inside list-disc space-y-1">
              <li>Zkontroluj složku spam.</li>
              <li>Počkej 1–2 minuty (občas má pošta zpoždění).</li>
              <li>
                Ujisti se, že jsi zadal správný email — pokud ne,{" "}
                <Link
                  href="/prihlaseni"
                  className="font-medium text-slate-900 underline-offset-4 hover:underline"
                >
                  zkus to znovu
                </Link>
                .
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
