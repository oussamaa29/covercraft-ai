import "server-only";
import nodemailer from "nodemailer";

interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Sends over plain SMTP — Gmail with an App Password works for free. With no
 * SMTP configured the app still runs: in development the message is printed
 * to the server console (so password reset is testable locally); in
 * production it's dropped with a warning, never echoed back to the client.
 */
export async function sendMail(mail: Mail): Promise<void> {
  if (!isMailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      console.warn(`[mail] SMTP not configured — "${mail.subject}" to ${mail.to} was not sent.`);
    } else {
      console.log(`\n[mail:dev] To: ${mail.to}\n[mail:dev] Subject: ${mail.subject}\n${mail.text}\n`);
    }
    return;
  }

  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({
    from: process.env.MAIL_FROM || `CoverCraft <${process.env.SMTP_USER}>`,
    ...mail,
  });
}
