import nodemailer from 'nodemailer';

let transport;
const configured = () => !!process.env.SMTP_HOST;

function get() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

/** Returns { delivered }. Without SMTP configured the message is logged (dev) and delivered=false. */
export async function sendMail(msg) {
  if (!configured()) {
    if (process.env.NODE_ENV !== 'test') console.log(`[mail:not-configured] to=${msg.to} subject="${msg.subject}"\n${msg.text}\n`);
    return { delivered: false };
  }
  await get().sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, ...msg });
  return { delivered: true };
}
