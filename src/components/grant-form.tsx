"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Check, Copy, Link2, Loader2, Trash2 } from "lucide-react";

import {
  createTipEditGrantAction,
  revokeTipEditGrantAction,
  type CreateTipEditGrantResult,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface GrantUser {
  id: string;
  label: string;
}

export interface GrantStage {
  label: string;
  matches: Array<{ id: string; label: string; dateLabel: string }>;
}

export interface ExistingGrant {
  id: string;
  url: string;
  userLabel: string;
  matchCount: number;
  expiresLabel: string;
  expired: boolean;
  usedLabel: string | null;
}

/** Date → "yyyy-MM-ddTHH:mm" v lokálním (= pražském) čase pro datetime-local. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition-colors focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/20";

export function GrantForm({
  users,
  stages,
  existingGrants,
  defaultExpiry,
}: {
  users: GrantUser[];
  stages: GrantStage[];
  existingGrants: ExistingGrant[];
  defaultExpiry: string;
}) {
  const [userId, setUserId] = useState("");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<CreateTipEditGrantResult | null>(null);
  const [pending, startTransition] = useTransition();

  function setPreset(deltaDays: number) {
    const d = new Date();
    d.setDate(d.getDate() + deltaDays);
    setExpiresAt(toLocalInput(d));
  }

  function toggle(id: string) {
    setChecked((c) => ({ ...c, [id]: !c[id] }));
  }

  function toggleStage(stage: GrantStage, value: boolean) {
    setChecked((c) => {
      const next = { ...c };
      for (const m of stage.matches) next[m.id] = value;
      return next;
    });
  }

  const checkedIds = useMemo(
    () => Object.keys(checked).filter((id) => checked[id]),
    [checked]
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const formData = new FormData();
    formData.set("userId", userId);
    formData.set("expiresAt", expiresAt);
    for (const id of checkedIds) formData.append("matchIds", id);
    startTransition(async () => {
      const result = await createTipEditGrantAction(null, formData);
      setState(result);
    });
  }

  const canSubmit = userId !== "" && expiresAt !== "" && checkedIds.length > 0;

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Uživatel */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <label
            htmlFor="grant-user"
            className="text-xs font-medium uppercase tracking-wider text-slate-500"
          >
            Pro koho
          </label>
          <select
            id="grant-user"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className={cn(inputClass, "mt-2")}
          >
            <option value="">— vyber kamaráda —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>

        {/* Expirace */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <label
            htmlFor="grant-expiry"
            className="text-xs font-medium uppercase tracking-wider text-slate-500"
          >
            Platnost odkazu do
          </label>
          <input
            id="grant-expiry"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={cn(inputClass, "mt-2")}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <PresetButton label="+24 hodin" onClick={() => setPreset(1)} />
            <PresetButton label="+3 dny" onClick={() => setPreset(3)} />
            <PresetButton label="+7 dní" onClick={() => setPreset(7)} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Čas je v pražské zóně. Po vypršení odkaz přestane fungovat.
          </p>
        </div>

        {/* Zápasy */}
        <div className="space-y-4">
          {stages.map((stage) => {
            const allChecked = stage.matches.every((m) => checked[m.id]);
            return (
              <div
                key={stage.label}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                  <h3 className="text-sm font-semibold tracking-wide text-slate-700">
                    {stage.label}
                  </h3>
                  <button
                    type="button"
                    onClick={() => toggleStage(stage, !allChecked)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800"
                  >
                    {allChecked ? "Odznačit kolo" : "Označit celé kolo"}
                  </button>
                </header>
                <ul className="divide-y divide-slate-100">
                  {stage.matches.map((m) => (
                    <li key={m.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={!!checked[m.id]}
                          onChange={() => toggle(m.id)}
                          className="size-4 shrink-0 rounded border-slate-300"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-900">
                            {m.label}
                          </span>
                          <span className="block text-[11px] uppercase tracking-wide text-slate-400">
                            {m.dateLabel}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Výsledek / generování */}
        <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              {checkedIds.length > 0
                ? `Vybráno ${checkedIds.length} ${
                    checkedIds.length === 1
                      ? "zápas"
                      : checkedIds.length < 5
                        ? "zápasy"
                        : "zápasů"
                  }`
                : "Zaškrtni aspoň jeden zápas"}
            </p>
            <Button
              type="submit"
              disabled={pending || !canSubmit}
              className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
            >
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Generuji…
                </>
              ) : (
                "Vygenerovat odkaz"
              )}
            </Button>
          </div>
          <GrantResult state={state} />
        </div>
      </form>

      {/* Aktivní odkazy */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Vystavené odkazy
        </h2>
        {existingGrants.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
            Zatím žádné odkazy.
          </p>
        ) : (
          <ul className="space-y-2">
            {existingGrants.map((g) => (
              <GrantRow key={g.id} grant={g} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PresetButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900"
    >
      {label}
    </button>
  );
}

function GrantResult({ state }: { state: CreateTipEditGrantResult | null }) {
  if (!state) return null;
  if (state.status === "ok") {
    return (
      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800">
          <Check className="size-4" /> Odkaz vytvořen — zkopíruj a pošli ho
          kamarádovi:
        </p>
        <CopyField value={state.url} />
      </div>
    );
  }
  const msg =
    state.status === "no-user"
      ? "Vyber kamaráda."
      : state.status === "no-matches"
        ? "Zaškrtni aspoň jeden platný zápas."
        : state.status === "bad-expiry"
          ? "Nastav platnost odkazu na čas v budoucnu."
          : state.status === "forbidden" || state.status === "unauth"
            ? "Nemáš oprávnění."
            : "Něco se pokazilo. Zkus to znovu.";
  return <p className="mt-3 text-sm text-rose-700">{msg}</p>;
}

function GrantRow({ grant }: { grant: ExistingGrant }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">
            {grant.userLabel}{" "}
            <span className="font-normal text-slate-500">
              · {grant.matchCount}{" "}
              {grant.matchCount === 1
                ? "zápas"
                : grant.matchCount < 5
                  ? "zápasy"
                  : "zápasů"}
            </span>
          </p>
          <p className="text-xs text-slate-500">
            {grant.expired ? (
              <span className="text-rose-600">Vypršel {grant.expiresLabel}</span>
            ) : (
              <>Platí do {grant.expiresLabel}</>
            )}
            {grant.usedLabel && <> · použito {grant.usedLabel}</>}
          </p>
        </div>
        <RevokeButton grantId={grant.id} userLabel={grant.userLabel} />
      </div>
      <div className="mt-2">
        <CopyField value={grant.url} />
      </div>
    </li>
  );
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-600">
        <Link2 className="size-3.5 shrink-0 text-slate-400" />
        <span className="truncate">{value}</span>
      </span>
      <button
        type="button"
        onClick={copy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
      >
        {copied ? (
          <>
            <Check className="size-3.5 text-emerald-600" /> Zkopírováno
          </>
        ) : (
          <>
            <Copy className="size-3.5" /> Kopírovat
          </>
        )}
      </button>
    </div>
  );
}

function RevokeButton({
  grantId,
  userLabel,
}: {
  grantId: string;
  userLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("grantId", grantId);
      await revokeTipEditGrantAction(null, fd);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger
        render={
          <button
            type="button"
            aria-label={`Zrušit odkaz pro ${userLabel}`}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
          />
        }
      >
        <Trash2 className="size-4" />
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity duration-150" />
        <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-xl data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity duration-150">
          <AlertDialog.Title className="text-base font-semibold text-slate-900">
            Zrušit odkaz pro {userLabel}?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-slate-600">
            Odkaz okamžitě přestane fungovat. Už zadané tipy zůstanou uložené.
            Tato akce je nevratná.
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Close
              render={
                <Button variant="outline" disabled={pending}>
                  Zpět
                </Button>
              }
            />
            <Button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {pending ? "Ruším…" : "Zrušit odkaz"}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
