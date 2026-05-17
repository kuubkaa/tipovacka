import { PageShell } from "@/components/page-shell";
import { isDeadlinePassed, tournament } from "@/config/tournament";

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default function TipyPage() {
  const passed = isDeadlinePassed();

  return (
    <PageShell
      title="Tipy všech hráčů"
      description={
        passed
          ? "Deadline uplynul — zobrazují se tipy všech."
          : `Tipy se zveřejní po uzávěrce: ${dateFormatter.format(tournament.deadline)}.`
      }
    >
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
        <p className="text-sm">
          {passed
            ? "Přehled tipů a průběžné bodování chystáme v další iteraci."
            : "Do uzávěrky vidí každý jen své vlastní tipy."}
        </p>
      </div>
    </PageShell>
  );
}
