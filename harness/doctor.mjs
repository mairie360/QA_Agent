#!/usr/bin/env node
/** Vérifie les branchements avant une session: `npm run doctor`. Les observateurs (base, Redis, mail) sont optionnels. */
import { FRONTS, cfg, frontUrl, selectEnv } from './config.mjs';
import { query } from './db.mjs';
import { redis } from './redis.mjs';

let failed = 0;
async function check(label, fn, { optional = false } = {}) {
  try {
    const detail = await fn();
    console.log(`  OK        ${label}${detail ? ` — ${detail}` : ''}`);
  } catch (e) {
    if (!optional) failed += 1;
    console.log(`  ${optional ? 'ABSENT   ' : 'ECHEC    '} ${label} — ${e.message}${optional ? ' (l’agent écrira « non vérifié »)' : ''}`);
  }
}

const envIdx = process.argv.indexOf('--env');
if (envIdx >= 0) selectEnv(process.argv[envIdx + 1]);
console.log(`Cible: ${cfg.env} (${cfg.domain})\n\nIndispensable`);
for (const front of FRONTS) {
  await check(`front ${front}`, async () => {
    const res = await fetch(frontUrl(front), { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
    return `HTTP ${res.status}`;
  });
}
await check('QA_MAILBOX (boîte de test réelle)', async () => cfg.mailbox.replace(/^(.).*@/, '$1***@'));
await check('QA_SEED_PASSWORD', async () => { cfg.seedPassword; return 'défini'; });

console.log('\nObservation (optionnelle)');
if (cfg.mail.provider === 'mailpit') {
  await check('Mailpit (lecture des e-mails)', async () => {
    const res = await fetch(`${cfg.mail.mailpitUrl}/api/v1/info`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return cfg.mail.mailpitUrl;
  }, { optional: true });
} else {
  await check('clé Resend (lecture des e-mails)', async () => {
    const res = await fetch('https://api.resend.com/emails?limit=1', { headers: { authorization: `Bearer ${cfg.resendKey}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status} (clé en accès complet requise pour lire les e-mails)`);
  }, { optional: true });
}
await check('base en lecture seule', async () => {
  const [row] = await query(
    `SELECT current_user AS who, r.rolsuper, r.rolcreatedb, r.rolcreaterole,
            (SELECT count(*) FROM information_schema.table_privileges
              WHERE grantee = current_user AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')) AS write_grants
       FROM pg_roles r WHERE r.rolname = current_user`,
  );
  if (row.rolsuper || row.rolcreatedb || row.rolcreaterole || Number(row.write_grants) > 0) {
    throw new Error(`le rôle ${row.who} a des droits d'écriture ou d'administration: corriger sql/readonly-role.sql`);
  }
  return `${row.who}, SELECT seul`;
}, { optional: true });
await check('Redis', async () => `révocations en cours: ${(await redis('scan', 'revoked:*')).length}`, { optional: true });

process.exit(failed ? 1 : 0);
