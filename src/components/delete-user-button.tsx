"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteUserAction } from "@/app/admin/actions";

type Props = {
  userId: string;
  userLabel: string;
  /** Kam přesměrovat po úspěšném smazání. Default = obnov aktuální stránku. */
  redirectTo?: string;
  /** Vizuální varianta tlačítka. */
  variant?: "icon" | "button";
};

export function DeleteUserButton({
  userId,
  userLabel,
  redirectTo,
  variant = "icon",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await deleteUserAction(userId);
      if (res.status === "ok") {
        setOpen(false);
        if (redirectTo) {
          router.push(redirectTo);
        } else {
          router.refresh();
        }
        return;
      }
      const msg =
        res.status === "self"
          ? "Nemůžeš smazat svůj vlastní účet."
          : res.status === "not-found"
            ? "Uživatel už neexistuje."
            : res.status === "forbidden" || res.status === "unauth"
              ? "Nemáš oprávnění tuto akci provést."
              : "Smazání selhalo. Zkus to znovu.";
      setError(msg);
    });
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger
        render={
          variant === "icon" ? (
            <button
              type="button"
              aria-label={`Smazat ${userLabel}`}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
            />
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"
            />
          )
        }
      >
        {variant === "icon" ? (
          <Trash2 className="size-4" />
        ) : (
          <>
            <Trash2 className="size-4" />
            Smazat účet
          </>
        )}
      </AlertDialog.Trigger>

      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity duration-150" />
        <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-xl data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity duration-150">
          <AlertDialog.Title className="text-base font-semibold text-slate-900">
            Smazat účet {userLabel}?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-slate-600">
            Smaže se uživatel, všechny jeho tipy (zápasy, pořadí skupin,
            postupující, speciální tipy) i jeho historie změn. Tato akce je
            nevratná.
          </AlertDialog.Description>

          {error && (
            <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Close
              render={
                <Button variant="outline" disabled={pending}>
                  Zrušit
                </Button>
              }
            />
            <Button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {pending ? "Mažu…" : "Smazat účet"}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
