"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import {
  sendInvitationsAction,
  type SendInvitationsResult,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const textareaClass =
  "w-full rounded-lg border border-slate-300 bg-white p-3 text-sm font-medium text-slate-900 outline-none transition-colors focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/20";

export function InvitationsForm() {
  const [emails, setEmails] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<SendInvitationsResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    if (emails.trim() === "") return;
    const formData = new FormData();
    formData.set("emails", emails);
    formData.set("message", message);
    startTransition(async () => {
      const result = await sendInvitationsAction(null, formData);
      setState(result);
      // Po úspěchu vyprázdnit textareu emailů, ať náhodou znova nepošle
      if (result.status === "ok" && result.failed.length === 0) {
        setEmails("");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <label
          htmlFor="emails"
          className="text-xs font-medium uppercase tracking-wider text-slate-500"
        >
          Emailové adresy
        </label>
        <textarea
          id="emails"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          rows={6}
          required
          placeholder={"jeden email na řádek, např.\nkarel@gmail.com\npavel@email.cz\n..."}
          className={cn(textareaClass, "mt-2 font-mono")}
        />
        <p className="mt-2 text-xs text-slate-500">
          Odděl emaily novým řádkem, čárkou, středníkem nebo mezerou.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <label
          htmlFor="message"
          className="text-xs font-medium uppercase tracking-wider text-slate-500"
        >
          Osobní vzkaz (volitelně)
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="např. „Hele kámo, dej tipy do tipovačky, ať máme komu vypít beer po finále."
          className={cn(textareaClass, "mt-2")}
        />
        <p className="mt-2 text-xs text-slate-500">
          Pokud necháš prázdné, použije se výchozí text.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-sm text-slate-600">
          {state?.status === "ok" && (
            <div className="space-y-1">
              {state.sent > 0 && (
                <p className="inline-flex items-center gap-1.5 text-emerald-700">
                  <Check className="size-4" />
                  Odesláno {state.sent}{" "}
                  {state.sent === 1
                    ? "mail"
                    : state.sent < 5
                      ? "maily"
                      : "mailů"}
                </p>
              )}
              {state.failed.length > 0 && (
                <p className="text-rose-700">
                  Selhalo {state.failed.length}:{" "}
                  {state.failed
                    .map((f) => `${f.email} (${f.error})`)
                    .join(", ")}
                </p>
              )}
              {state.invalid.length > 0 && (
                <p className="text-amber-700">
                  Neplatné adresy (přeskočeno): {state.invalid.join(", ")}
                </p>
              )}
            </div>
          )}
          {state?.status === "forbidden" && (
            <span className="text-rose-700">Nemáš admin práva.</span>
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
          disabled={pending || emails.trim() === ""}
          className="h-11 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
        >
          {pending ? (
            <>
              <Loader2 className="mr-1.5 size-4 animate-spin" />
              Odesílám…
            </>
          ) : (
            "Odeslat pozvánky"
          )}
        </Button>
      </div>
    </form>
  );
}
