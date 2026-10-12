#!/usr/bin/env node
/**
 * Lecteur d'e-mails de la stack locale, contre un FAUX Mailpit (mêmes routes /api/v1/search et /api/v1/message/{id}).
 * Vérifie notre code (filtre destinataire/sujet/date, extraction des liens), PAS la forme réelle de l'API Mailpit,
 * écrite d'après sa documentation: à confirmer au premier lancement local (`npm run doctor -- --env local`).
 */
import http from 'node:http';

const messages = [
  { ID: 'old', Subject: 'Ancien', Created: '2020-01-01T00:00:00Z', To: [{ Address: 'qa+x@mairie360.local' }], From: { Address: 'noreply@mairie360.local' } },
  { ID: 'm1', Subject: 'Réinitialisation de votre mot de passe', Created: new Date().toISOString(), To: [{ Address: 'qa+x@mairie360.local' }], From: { Address: 'noreply@mairie360.local' } },
];
const bodies = { m1: { ID: 'm1', Subject: 'Réinitialisation de votre mot de passe', From: { Address: 'noreply@mairie360.local' }, To: [{ Address: 'qa+x@mairie360.local' }], Text: 'Bonjour, ouvrez https://login.mairie360.localtest.me/reset?token=abc123 pour continuer.', HTML: '<p><a href="https://login.mairie360.localtest.me/reset?token=abc123&amp;x=1">lien</a></p>' } };
const seen = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  seen.push(url.pathname + url.search);
  res.setHeader('content-type', 'application/json');
  if (url.pathname === '/api/v1/search') {
    const q = url.searchParams.get('query') ?? '';
    const to = q.replace(/^to:/, '');
    return res.end(JSON.stringify({ total: 2, messages: messages.filter((m) => m.To.some((t) => t.Address === to)) }));
  }
  const m = url.pathname.match(/^\/api\/v1\/message\/(.+)$/);
  if (m && bodies[m[1]]) return res.end(JSON.stringify(bodies[m[1]]));
  res.statusCode = 404; res.end('{}');
});
await new Promise((r) => server.listen(0, r));

process.env.QA_ENV = 'local';
process.env.QA_MAILPIT_URL = `http://127.0.0.1:${server.address().port}`;
const { waitForMail } = await import('../harness/mail.mjs');

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`  ${ok ? 'OK    ' : 'ECHEC '} ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed += 1; };

const mail = await waitForMail({ to: 'qa+x@mairie360.local', subject: 'mot de passe', timeoutS: 5 });
check('retrouve le message récent par destinataire et sujet', mail.id === 'm1' && /mot de passe/.test(mail.subject), mail.subject);
check('ignore le message trop ancien', mail.id !== 'old');
check('extrait les liens (html et texte, &amp; décodé)', mail.links.includes('https://login.mairie360.localtest.me/reset?token=abc123&x=1') && mail.links.some((l) => l.endsWith('token=abc123')), `${mail.links.length} lien(s)`);
check('requête Mailpit « to:<adresse> »', seen.some((s) => s.includes('query=to%3Aqa%2Bx%40mairie360.local')), seen[0]);

let timedOut = false;
try { await waitForMail({ to: 'inconnu@mairie360.local', timeoutS: 1 }); } catch (e) { timedOut = /Aucun e-mail/.test(e.message); }
check('expire proprement sans message', timedOut);

server.close();
console.log(failed ? `\n${failed} échec(s)` : '\nTout est OK');
process.exit(failed ? 1 : 0);
