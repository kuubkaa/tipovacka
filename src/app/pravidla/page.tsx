import { PageShell } from "@/components/page-shell";

export default function PravidlaPage() {
  return (
    <PageShell
      title="Pravidla bodování"
      description="Jak se počítají body za tipy."
    >
      <div className="space-y-4 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-slate-600">
        <p className="text-sm">
          Konkrétní bodová schémata domluvíme společně v další iteraci. Pracovní
          návrh:
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm">
          <li>Přesný výsledek zápasu — nejvíc bodů</li>
          <li>Správný vítěz a gólový rozdíl — méně</li>
          <li>Jen správný vítěz / remíza — nejméně</li>
          <li>Bonusy za vítěze skupin, postupy, krále střelců a vítěze turnaje</li>
        </ul>
      </div>
    </PageShell>
  );
}
