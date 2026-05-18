"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import { saveProfileAction, type SaveProfileResult } from "@/app/profil/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base font-medium text-slate-900 outline-none transition-colors focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/20";

export function ProfileForm({
  initialName,
  email,
}: {
  initialName: string | null;
  email: string;
}) {
  const [name, setName] = useState<string>(initialName ?? "");
  const [state, setState] = useState<SaveProfileResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const formData = new FormData();
    formData.set("name", name);
    startTransition(async () => {
      const result = await saveProfileAction(null, formData);
      setState(result);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <label
          htmlFor="email"
          className="text-xs font-medium uppercase tracking-wider text-slate-500"
        >
          Email (přihlašovací)
        </label>
        <p
          id="email"
          className="mt-1 text-sm font-medium text-slate-700"
          title={email}
        >
          {email}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Email nelze měnit — je svázaný s tvým účtem.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <label
          htmlFor="name"
          className="text-xs font-medium uppercase tracking-wider text-slate-500"
        >
          Zobrazované jméno
        </label>
        <input
          id="name"
          name="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="např. Jakub Milotinský"
          maxLength={50}
          required
          autoFocus={!initialName}
          className={cn(inputClass, "mt-2")}
        />
        <p className="mt-2 text-xs text-slate-500">
          Pod tímto jménem tě uvidí ostatní v pořadí a u tipů. Doporučuju
          jméno + příjmení, ať se kamarádi poznají.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-slate-600">
          {state?.status === "ok" && (
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <Check className="size-4" />
              Uloženo
            </span>
          )}
          {state?.status === "tooShort" && (
            <span className="text-rose-700">Jméno nemůže být prázdné.</span>
          )}
          {state?.status === "tooLong" && (
            <span className="text-rose-700">Maximálně 50 znaků.</span>
          )}
          {state?.status === "unauth" && (
            <span className="text-rose-700">Nejsi přihlášen.</span>
          )}
          {state?.status === "error" && (
            <span className="text-rose-700">Chyba: {state.message}</span>
          )}
        </div>
        <Button
          type="submit"
          disabled={pending}
          className="h-11 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
        >
          {pending ? (
            <>
              <Loader2 className="mr-1.5 size-4 animate-spin" />
              Ukládám…
            </>
          ) : (
            "Uložit"
          )}
        </Button>
      </div>
    </form>
  );
}
