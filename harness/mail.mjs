/**
 * E-mails envoyés par staging (core-api et Keycloak passent par Resend), lus via l'API Resend.
 * `last_event` (delivered, bounced…) dit si Resend l'a réellement remis. Limite Resend: 2 requêtes/s.
 */
import { cfg } from './config.mjs';

const API = 'https://api.resend.com';

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${cfg.resendKey}` } });
  if (!res.ok) throw new Error(`Resend ${path} -> ${res.status}`);
  return res.json();
}

function linksOf(email) {
  const found = new Set();
  for (const m of `${email.html ?? ''}\n${email.text ?? ''}`.matchAll(/https?:\/\/[^\s"'<>)]+/g)) found.add(m[0].replace(/&amp;/g, '&'));
  return [...found];
}

// Stack locale: les e-mails de l'app arrivent dans Mailpit (API HTTP publiée sur 127.0.0.1).
async function mailpit(path) {
  const res = await fetch(`${cfg.mail.mailpitUrl}${path}`);
  if (!res.ok) throw new Error(`Mailpit ${path} -> ${res.status}`);
  return res.json();
}

async function waitForMailpit({ to, subject, after, timeoutS }) {
  const since = after ? new Date(after).getTime() : Date.now() - 15 * 60_000;
  const deadline = Date.now() + timeoutS * 1000;
  const pattern = subject ? new RegExp(subject, 'i') : null;
  while (Date.now() < deadline) {
    const list = await mailpit(`/api/v1/search?query=${encodeURIComponent(`to:${to}`)}&limit=50`);
    const hit = (list.messages ?? [])
      .filter((m) => new Date(m.Created).getTime() >= since)
      .filter((m) => !pattern || pattern.test(m.Subject ?? ''))
      .sort((a, b) => new Date(b.Created) - new Date(a.Created))[0];
    if (hit) {
      const full = await mailpit(`/api/v1/message/${hit.ID}`);
      return {
        id: hit.ID,
        to: (full.To ?? hit.To ?? []).map((t) => t.Address),
        from: full.From?.Address,
        subject: full.Subject ?? hit.Subject,
        created_at: hit.Created,
        last_event: 'delivered (Mailpit local)',
        links: linksOf({ html: full.HTML, text: full.Text }),
        text: (full.Text ?? (full.HTML ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, 1500),
      };
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Aucun e-mail pour ${to} après ${timeoutS}s (Mailpit)`);
}

export async function waitForMail({ to, subject, after, timeoutS = 90 }) {
  if (cfg.mail.provider === 'mailpit') return waitForMailpit({ to, subject, after, timeoutS });
  const since = after ? new Date(after).getTime() : Date.now() - 15 * 60_000;
  const deadline = Date.now() + timeoutS * 1000;
  const wanted = to.toLowerCase();
  const pattern = subject ? new RegExp(subject, 'i') : null;
  while (Date.now() < deadline) {
    const list = await get('/emails?limit=50');
    const hit = (list.data ?? [])
      .filter((m) => (m.to ?? []).some((t) => t.toLowerCase().includes(wanted)))
      .filter((m) => new Date(m.created_at).getTime() >= since)
      .filter((m) => !pattern || pattern.test(m.subject ?? ''))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    if (hit) {
      const full = await get(`/emails/${hit.id}`);
      return {
        id: full.id,
        to: full.to,
        from: full.from,
        subject: full.subject,
        created_at: full.created_at,
        last_event: full.last_event,
        links: linksOf(full),
        text: (full.text ?? (full.html ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, 1500),
      };
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Aucun e-mail pour ${to} après ${timeoutS}s`);
}
