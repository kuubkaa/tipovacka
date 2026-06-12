import { ProfileForm } from "@/components/profile-form";
import { SiteHeader } from "@/components/site-header";
import { requireSession } from "@/lib/auth-guards";
import { db } from "@/lib/db";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Open-redirect ochrana: povolíme jen interní cesty ("/...").
  const redirectTo =
    next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;

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
      <SiteHeader active="profil" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="mb-4 text-xl font-bold tracking-tight sm:text-2xl">
          Profil
        </h1>
        {!user.name && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Vítej! Než začneš, doplň si jméno a příjmení</strong>, ať tě
            kamarádi v pořadí a u tipů poznají. Bez jména se všude zobrazuje
            tvůj email.
          </div>
        )}
        <ProfileForm
          initialName={user.name}
          email={user.email}
          redirectTo={redirectTo}
        />
      </main>
    </div>
  );
}
