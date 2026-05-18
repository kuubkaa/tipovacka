import Link from "next/link";

import { InvitationsForm } from "@/components/invitations-form";
import { tournament } from "@/config/tournament";
import { requireAdmin } from "@/lib/auth-guards";

export default async function AdminInvitationsPage() {
  const session = await requireAdmin("/admin/pozvanky");

  return (
    <div className="flex flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <Link
              href="/admin"
              className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
            >
              ← Admin
            </Link>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              Pozvánky kamarádům
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            {tournament.shortName} ·{" "}
            <span className="font-medium text-slate-700">
              {session.user.name ?? session.user.email}
            </span>
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <p>
            Pošli přátelům úvodní email s odkazem na tipovačku a krátkým
            návodem. Z mailu se odesílá přes tvůj Gmail (
            <span className="font-mono">
              {process.env.EMAIL_FROM ?? "EMAIL_FROM"}
            </span>
            ).
          </p>
          <p className="mt-2 text-xs text-slate-500">
            <strong>Tip:</strong> u Gmail SMTP je limit 500 mailů/den. Posílej
            klidně i v několika dávkách, ale pozor na rate-limit.
          </p>
        </div>
        <InvitationsForm />
      </main>
    </div>
  );
}
