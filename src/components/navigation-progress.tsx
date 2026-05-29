"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Tenký indikátor načítání nahoře na obrazovce. Rozjede se hned po kliknutí
 * na interní odkaz a dokončí se, jakmile se nová stránka načte (změní se
 * cesta). Dává uživateli okamžitou zpětnou vazbu „něco se děje" u přechodů
 * mezi stránkami (zvlášť u datově náročných jako /formular nebo /leaderboard).
 *
 * Bez externí závislosti. Pokrývá kliknutí na <a> (i ty stylované jako
 * tlačítka) a tlačítka prohlížeče zpět/vpřed. Ukládací formuláře mají vlastní
 * spinner („Ukládám…"), takže ty řeší zpětnou vazbu samy.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const active = useRef(false);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (trickle.current) {
      clearInterval(trickle.current);
      trickle.current = null;
    }
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (safety.current) {
      clearTimeout(safety.current);
      safety.current = null;
    }
  }

  function start() {
    clearTimers();
    active.current = true;
    setVisible(true);
    setProgress(8);
    // Postupně se plní k ~92 %, zbytek se dorazí po dokončení navigace.
    trickle.current = setInterval(() => {
      setProgress((p) => (p < 92 ? p + (92 - p) * 0.12 : p));
    }, 180);
    // Pojistka: kdyby navigace neproběhla (např. zrušená), po 10 s schovej.
    safety.current = setTimeout(stop, 10_000);
  }

  function stop() {
    if (!active.current) return;
    active.current = false;
    clearTimers();
    setProgress(100);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 220);
  }

  // Dokonči, jakmile se změní cesta (= navigace doběhla).
  useEffect(() => {
    stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Odchyť kliknutí na interní odkazy + tlačítka zpět/vpřed.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;

      const targetAttr = anchor.getAttribute("target");
      if (targetAttr && targetAttr !== "_self") return; // nová karta
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return; // kotva na téže stránce

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return; // externí odkaz
      if (url.pathname === window.location.pathname) return; // jen query/hash

      start();
    }

    function onPopState() {
      start();
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
    >
      <div
        className="h-full rounded-r-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)] transition-all duration-200 ease-out"
        style={{ width: `${progress}%`, opacity: progress >= 100 ? 0 : 1 }}
      />
    </div>
  );
}
