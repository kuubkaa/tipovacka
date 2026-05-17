import Link from "next/link";
import { Mail } from "lucide-react";

import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tournament } from "@/config/tournament";

type SearchParams = Promise<{
  error?: string;
  callbackUrl?: string;
}>;

export default async function PrihlaseniPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, callbackUrl } = await searchParams;

  async function signInAction(formData: FormData) {
    "use server";
    await signIn("resend", {
      email: formData.get("email"),
      redirectTo: callbackUrl ?? "/",
    });
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
          >
            {tournament.shortName}
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Mail className="size-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Přihlášení</h1>
            <p className="mt-2 text-sm text-slate-600">
              Pošleme ti email s přihlašovacím odkazem. Bez hesla.
            </p>
          </div>

          <form action={signInAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="ty@email.cz"
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              className="h-11 w-full rounded-lg bg-slate-900 text-base font-medium text-white hover:bg-slate-800"
            >
              Pošli mi přihlašovací link
            </Button>
          </form>

          {error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error === "Verification"
                ? "Tento odkaz vypršel nebo už byl použit. Zažádej o nový."
                : "Něco se nepovedlo. Zkus to znovu."}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Tipovačka je jen pro pozvané. Pokud nevidíš email, zkontroluj spam.
        </p>
      </div>
    </div>
  );
}
