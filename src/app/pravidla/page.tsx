import { PageShell } from "@/components/page-shell";
import { SCORING } from "@/lib/scoring";

export default function PravidlaPage() {
  return (
    <PageShell
      title="Pravidla bodování"
      description="Jak se počítají body za jednotlivé tipy."
      active="pravidla"
    >
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card title="Tipy zápasů">
          <p className="text-sm text-slate-600">
            Za každý zápas získá tipující body podle nejvyššího splněného
            pravidla. <strong>Body se nesčítají</strong>, započítá se pouze
            nejvyšší bodové ohodnocení.
          </p>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              <Row
                label="Přesné skóre"
                example="tip 2:1, výsledek 2:1"
                points={SCORING.match.exact}
              />
              <Row
                label="Vítěz/remíza + gólový rozdíl"
                example="tip 2:1, výsledek 3:2 (oba +1 pro domácí)"
                points={SCORING.match.winnerAndDiff}
              />
              <Row
                label="Jen vítěz"
                example="tip 2:1, výsledek 4:0 (oba výhra domácí, jiný rozdíl)"
                points={SCORING.match.winnerOnly}
              />
              <Row
                label="Útěcha — stejný počet gólů"
                example="tip 3:0, výsledek 1:2 (oba 3 góly, jiný vítěz)"
                points={SCORING.match.totalGoals}
              />
            </tbody>
          </table>
        </Card>

        <Card title="Pořadí ve skupině (1.–4. místo)">
          <ul className="list-none space-y-1 text-sm text-slate-700">
            <Bullet>
              <strong>{SCORING.groupRanking.perPosition} b</strong> za každou
              správně tipnutou pozici
            </Bullet>
            <Bullet>
              <strong>
                {4 * SCORING.groupRanking.perPosition +
                  SCORING.groupRanking.perfectBonus}{" "}
                b
              </strong>{" "}
              za správně určené celé pořadí skupiny
            </Bullet>
          </ul>
        </Card>

        <Card title="Král střelců skupiny">
          <p className="text-sm text-slate-700">
            <strong>{SCORING.groupScorer} b</strong> za každého správně
            tipnutého krále střelců skupiny.
          </p>
        </Card>

        <Card title="Postupující do vyřazovacích kol">
          <p className="text-sm text-slate-600">
            Body se počítají za každý správně tipnutý postupující tým v daném
            kole.
          </p>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              <Row
                label="Šestnáctifinále (R32)"
                points={SCORING.advancers.R32}
              />
              <Row
                label="Osmifinále (R16)"
                points={SCORING.advancers.R16}
              />
              <Row label="Čtvrtfinále" points={SCORING.advancers.QF} />
              <Row label="Semifinále" points={SCORING.advancers.SF} />
              <Row label="O 3. místo" points={SCORING.advancers.BRONZ} />
              <Row label="Finále" points={SCORING.advancers.F} />
            </tbody>
          </table>
        </Card>

        <Card title="Speciální tipy">
          <ul className="list-none space-y-1 text-sm text-slate-700">
            <Bullet>
              <strong>Vítěz turnaje:</strong> {SCORING.tournamentWinner} b
            </Bullet>
            <Bullet>
              <strong>Král střelců turnaje:</strong>{" "}
              {SCORING.tournamentTopScorer} b
            </Bullet>
          </ul>
        </Card>

        <Card title="Rovnost bodů">
          <p className="text-sm text-slate-600">
            Pokud má více tipérů stejný počet bodů, o lepším pořadí rozhoduje
            postupně:
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>správně tipnutý vítěz turnaje,</li>
            <li>
              při další rovnosti vyšší počet správně tipnutých přesných
              výsledků zápasů.
            </li>
          </ol>
        </Card>

      </div>
    </PageShell>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-2 text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Row({
  label,
  example,
  points,
}: {
  label: string;
  example?: string;
  points: number;
}) {
  return (
    <tr>
      <td className="py-2 pr-3 align-top">
        <div className="font-medium text-slate-800">{label}</div>
        {example && (
          <div className="text-xs text-slate-500">{example}</div>
        )}
      </td>
      <td className="py-2 text-right align-top text-base font-bold tabular-nums text-emerald-700">
        {points} b
      </td>
    </tr>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li>
      <span>{children}</span>
    </li>
  );
}

