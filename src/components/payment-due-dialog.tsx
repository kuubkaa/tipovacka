"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { AlertCircle } from "lucide-react";

/**
 * Okno připomínající nezaplacené startovné. Renderuje se ze server layoutu
 * jen nezaplaceným tipérům po deadlinu. Otevře se při načtení a znovu při
 * každém přechodu na jinou (pod)stránku, dokud platba nedorazí.
 */
export function PaymentDueDialog({ qrUrl }: { qrUrl: string }) {
  const pathname = usePathname();
  // Okno bereme jako zavřené jen na cestě, kde ho uživatel sám zavřel.
  // Po přechodu na jinou (pod)stránku se `pathname` změní a okno se otevře.
  const [dismissedPath, setDismissedPath] = useState<string | null>(null);
  const open = dismissedPath !== pathname;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setDismissedPath(pathname);
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-xl transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-amber-100">
            <AlertCircle className="size-6 text-amber-600" />
          </div>
          <Dialog.Title className="text-base font-semibold text-slate-900">
            Nezaplacené startovné
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-slate-600">
            Pořadatel stále neeviduje tvoji platbu za startovné. Naskenuj prosím
            QR kód v bankovní aplikaci a zaplať co nejdříve.
          </Dialog.Description>

          <div className="mt-4 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt="QR kód pro platbu startovného"
              className="size-56 rounded-lg border border-slate-200 bg-white object-contain p-2"
            />
          </div>

          <div className="mt-5">
            <Dialog.Close className="inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700">
              Zavřít
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
