import "server-only";

import nodemailer from "nodemailer";

/**
 * Vytvoří SMTP transporter ze stejných env vars, jako používá Auth.js
 * pro magic link (EMAIL_SERVER_*). V dev módu bez SMTP returnuje "console"
 * fallback, který maily jen loguje.
 */
function createTransporter() {
  const host = process.env.EMAIL_SERVER_HOST;
  const port = Number(process.env.EMAIL_SERVER_PORT ?? 0);
  const user = process.env.EMAIL_SERVER_USER;
  const pass = process.env.EMAIL_SERVER_PASSWORD;

  const haveSmtp = host && port && user && pass;
  if (!haveSmtp) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export interface SendMailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendMail(params: SendMailParams): Promise<void> {
  const transporter = createTransporter();
  const from =
    process.env.EMAIL_FROM ??
    process.env.EMAIL_SERVER_USER ??
    "noreply@tipovacka.local";

  if (!transporter) {
    // Dev fallback — loguje do konzole místo posílání
    // eslint-disable-next-line no-console
    console.log(
      `\n========================================\n` +
        `📧 [DEV] Mail pro ${params.to}\n` +
        `Subject: ${params.subject}\n` +
        `From: ${from}\n` +
        `---\n${params.text}\n` +
        `========================================\n`
    );
    return;
  }

  await transporter.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}

/** Validace emailové adresy (jednoduchá, server-side) */
export function isValidEmail(email: string): boolean {
  // Stačí formát jako "x@y.z" — Resend/Gmail udělají reálnou validaci
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
