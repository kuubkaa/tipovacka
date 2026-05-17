import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageShell } from "@/components/page-shell";

export default async function FormularPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/prihlaseni?callbackUrl=/formular");
  }

  return (
    <PageShell
      title="Vyplnit tipy"
      description={`Přihlášen jako ${session.user.email}. Formulář chystáme v další iteraci.`}
    >
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
        <p className="text-sm">
          Formulář pro zadání tipů na zápasy, pořadí skupin, vyřazovací část,
          krále střelců a celkového vítěze připravujeme v další iteraci.
        </p>
      </div>
    </PageShell>
  );
}
