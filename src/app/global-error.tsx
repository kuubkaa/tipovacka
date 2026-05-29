"use client";

import { useEffect } from "react";

/**
 * Poslední záchrana — zachytí chyby, které spadnou v samotném root
 * layoutu (kde už nefunguje běžný error.tsx). Musí renderovat vlastní
 * <html>/<body>, protože nahrazuje celý dokument.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="cs">
      <body
        style={{
          fontFamily:
            "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px",
          color: "#0f172a",
          background: "#f8fafc",
        }}
      >
        <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "0 0 8px" }}>
          Něco se pokazilo
        </h1>
        <p style={{ color: "#475569", margin: "0 0 24px", fontSize: "14px" }}>
          Aplikace narazila na neočekávanou chybu.
        </p>
        <button
          onClick={reset}
          style={{
            background: "#0f172a",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "10px 20px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Zkusit znovu
        </button>
      </body>
    </html>
  );
}
