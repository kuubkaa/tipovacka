import { PageShell } from "@/components/page-shell";

export default function FormularPage() {
  return (
    <PageShell
      title="Vyplnit tipy"
      description="Tady bude tipovací formulář — zatím rozpracováno."
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
