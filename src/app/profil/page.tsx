import Link from "next/link";
import { UserCircle } from "lucide-react";

import { ProfileForm } from "@/components/profile-form";
import { tournament } from "@/config/tournament";
import { requireSession } from "@/lib/auth-guards";
import { db } from "@/lib/db";

export default async function ProfilePage() {
  const session = await requireSession("/profil");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <Link
              href="/"
              className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
            >
              ← {tournament.shortName}
            </Link>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              Profil
            </h1>
          </div>
          <UserCircle className="size-5 text-slate-500" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {!user.name && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Doplň si jméno</strong>, ať tě kamarádi v pořadí a u tipů
            poznají. Bez jména se všude zobrazuje tvůj email.
          </div>
        )}
        <ProfileForm initialName={user.name} email={user.email} />
      </main>
    </div>
  );
}
