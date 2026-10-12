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

export async function waitForMail({ to, subject, after, timeoutS = 90 }) {
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
