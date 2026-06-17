"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import type { ActivePage } from "@/components/site-header";

interface NavItem {
  href: string;
  label: string;
  active?: boolean;
}

function pillClass(active?: boolean) {
  return (
    "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors " +
    (active
      ? "bg-slate-900 text-white ring-slate-900"
      : "text-slate-700 ring-slate-300 hover:bg-slate-100")
  );
}

/**
 * Responzivní navigace. Na mobilu se položky schovají do hamburger menu
 * (rozbalovací panel), na sm+ se zobrazují inline jako dosud — tím se na úzké
 * obrazovce vejdou i „Admin" a „Odhlásit".
 */
export function SiteNav({
  active,
  isAdmin,
  isLoggedIn,
  signOutAction,
}: {
  active?: ActivePage;
  isAdmin: boolean;
  isLoggedIn: boolean;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const items: NavItem[] = [];
  if (active !== "tipy-vlastni")
    items.push({ href: "/formular", label: "Tvoje tipy" });
  if (active !== "tipy-vsech")
    items.push({ href: "/tipy", label: "Tipy všech" });
  items.push({
    href: "/leaderboard",
    label: "Pořadí",
    active: active === "leaderboard",
  });
  items.push({
    href: "/pravidla",
    label: "Pravidla",
    active: active === "pravidla",
  });
  items.push({ href: "/profil", label: "Profil", active: active === "profil" });
  if (isAdmin) items.push({ href: "/admin", label: "Admin" });

  return (
    <>
      {/* Desktop / tablet: inline pilulky */}
      <nav className="hidden items-center gap-1.5 sm:flex">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={pillClass(item.active)}>
            {item.label}
          </Link>
        ))}
        {isLoggedIn && (
          <form action={signOutAction}>
            <button
              type="submit"
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 ring-1 ring-slate-300 hover:bg-slate-100"
            >
              Odhlásit
            </button>
          </form>
        )}
      </nav>

      {/* Mobil: hamburger + rozbalovací panel */}
      <div className="relative sm:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
          aria-expanded={open}
          className="inline-flex size-9 items-center justify-center rounded-full text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>

        {open && (
          <>
            {/* Klik mimo panel ho zavře */}
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div className="absolute right-0 top-full z-50 mt-2 flex w-44 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
                    (item.active
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100")
                  }
                >
                  {item.label}
                </Link>
              ))}
              {isLoggedIn && (
                <form action={signOutAction} className="border-t border-slate-100 pt-1">
                  <button
                    type="submit"
                    className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-500 hover:bg-slate-100"
                  >
                    Odhlásit
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
