import { PageShell } from "@/components/page-shell";
import { SCORING } from "@/lib/scoring";

export default function PravidlaPage() {
  return (
    <PageShell
      title="Pravidla bodování"
      description="Jak se počítají body za jednotlivé tipy."
    >
      <div className="space-y-6">
        <Card title="Tipy zápasů — cascade">
          <p className="text-sm text-slate-600">
            Za každý zápas dostane tipér body z nejvyššího pravidla, které
            sedí. <strong>Body se nesčítají</strong> — započítá se jen nejlepší
            tier.
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
          <p className="mt-2 text-xs text-slate-500">
            Pozn.: remíza vždy spadne do druhého tieru (rozdíl 0 sedí), nikdy
            do třetího.
          </p>
        </Card>

        <Card title="Pořadí ve skupině (1.–4. místo)">
          <ul className="space-y-1 text-sm text-slate-700">
            <Bullet>
              <strong>{SCORING.groupRanking.perPosition} b</strong> za každou
              správně tipnutou pozici (max 8 b)
            </Bullet>
            <Bullet>
              <strong>+{SCORING.groupRanking.perfectBonus} b bonus</strong>,
              pokud sedí všechny 4 pozice naráz
            </Bullet>
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Maximum za skupinu = 4 × {SCORING.groupRanking.perPosition} +{" "}
            {SCORING.groupRanking.perfectBonus} ={" "}
            {4 * SCORING.groupRanking.perPosition +
              SCORING.groupRanking.perfectBonus}{" "}
            b · za všech 12 skupin ={" "}
            {12 *
              (4 * SCORING.groupRanking.perPosition +
                SCORING.groupRanking.perfectBonus)}{" "}
            b.
          </p>
        </Card>

        <Card title="Král střelců skupiny">
          <p className="text-sm text-slate-700">
            <strong>{SCORING.groupScorer} b</strong> za každého správně
            tipnutého krále střelců skupiny (jméno hráče se porovnává
            case-insensitive). Za všech 12 skupin maximum{" "}
            {12 * SCORING.groupScorer} b.
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
                example="32 týmů × bodů za tým"
                points={SCORING.advancers.R32}
              />
              <Row
                label="Osmifinále (R16)"
                example="16 týmů × bodů za tým"
                points={SCORING.advancers.R16}
              />
              <Row
                label="Čtvrtfinále"
                example="8 týmů × bodů za tým"
                points={SCORING.advancers.QF}
              />
              <Row
                label="Semifinále"
                example="4 týmy × bodů za tým"
                points={SCORING.advancers.SF}
              />
              <Row
                label="O 3. místo"
                example="2 týmy (poražení ze SF) × bodů za tým"
                points={SCORING.advancers.BRONZ}
              />
              <Row
                label="Finále"
                example="2 týmy × bodů za tým"
                points={SCORING.advancers.F}
              />
            </tbody>
          </table>
        </Card>

        <Card title="Speciální tipy">
          <ul className="space-y-1 text-sm text-slate-700">
            <Bullet>
              <strong>Vítěz turnaje:</strong> {SCORING.tournamentWinner} b
            </Bullet>
            <Bullet>
              <strong>Král střelců turnaje:</strong>{" "}
              {SCORING.tournamentTopScorer} b
            </Bullet>
          </ul>
        </Card>

        <Card title="Celkové maximum">
          <p className="text-sm text-slate-700">
            Při dokonale trefených tipech a všech zadaných výsledcích lze
            získat <strong>≈ {totalMax()} bodů</strong>. Reálně se pohybuje
            výsledek hluboko pod tímto stropem.
          </p>
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
  example: string;
  points: number;
}) {
  return (
    <tr>
      <td className="py-2 pr-3 align-top">
        <div className="font-medium text-slate-800">{label}</div>
        <div className="text-xs text-slate-500">{example}</div>
      </td>
      <td className="py-2 text-right align-top text-base font-bold tabular-nums text-emerald-700">
        {points} b
      </td>
    </tr>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1 inline-block size-1.5 shrink-0 rounded-full bg-slate-400" />
      <span>{children}</span>
    </li>
  );
}

function totalMax(): number {
  const matchMax = 72 * SCORING.match.exact;
  const groupMax =
    12 *
    (4 * SCORING.groupRanking.perPosition + SCORING.groupRanking.perfectBonus);
  const scorerMax = 12 * SCORING.groupScorer;
  const advancersMax =
    32 * SCORING.advancers.R32 +
    16 * SCORING.advancers.R16 +
    8 * SCORING.advancers.QF +
    4 * SCORING.advancers.SF +
    2 * SCORING.advancers.BRONZ +
    2 * SCORING.advancers.F;
  const specialMax =
    SCORING.tournamentWinner + SCORING.tournamentTopScorer;
  return matchMax + groupMax + scorerMax + advancersMax + specialMax;
}
