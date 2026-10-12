#!/usr/bin/env node
/**
 * Test de fumée du serveur MCP, sans staging: démarre le serveur en stdio, liste les outils et joue une session factice
 * (marqueur, journal, alias, instantanés, validation du rapport). `npm run selftest`.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { REQUIRED_SECTIONS } from '../harness/run.mjs';
import path from 'node:path';
import { ROOT } from '../harness/config.mjs';

let failed = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'OK    ' : 'ECHEC '} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed += 1;
};

const client = new Client({ name: 'selftest', version: '1.0.0' });
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: [path.join(ROOT, 'mcp', 'server.mjs')],
    env: { ...process.env, QA_MAILBOX: 'testeur@example.com', QA_DOMAIN: 'staging.mairie360-eip.fr', QA_MAX_ACTIONS: '2', QA_SEED_PASSWORD: 'Seed-Password-1', QA_ADMIN_EMAIL: 'admin@example.com', QA_ADMIN_PASSWORD: 'Admin-Password-1' },
  }),
);
const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content?.[0]?.text ?? '';
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { isError: !!res.isError, text, json };
};

const tools = (await client.listTools()).tools.map((t) => t.name);
check('outils exposés', ['run_start', 'run_alias', 'journal', 'db_query', 'redis_read', 'mail_wait', 'snapshot', 'snapshot_diff', 'report_write'].every((t) => tools.includes(t)), tools.join(', '));
check('aucun outil d’écriture applicative', !tools.some((t) => /create|update|delete|write_db|exec/.test(t.replace('report_write', ''))));

const start = await call('run_start', { persona: 'Agent d’accueil', mission: 'Test de fumée', behavior: 'pressé' });
check('run_start', !start.isError && /^\[QA-[0-9a-f]{4}\]$/.test(start.json.marker), start.json.marker);
check('date du jour fournie', /\d{4}-\d{2}-\d{2}/.test(start.json.today), start.json.today);

const al = await call('run_alias', { label: 'Nouvel Arrivant' });
check('alias unique', al.json === `testeur+qa-${start.json.runId}-nouvel-arrivant@example.com`, al.json);

const j1 = await call('journal', { kind: 'action', text: 'Ouvre la page de connexion' });
check('journal compte les actions', j1.json.actions === 1 && j1.json.remaining === 1);
const j2 = await call('journal', { kind: 'action', text: 'Clique sur Se connecter', evidence: 'captures/01.png' });
check('avertissement de budget', /Budget/.test(j2.json.warning ?? ''), j2.json.warning);

const acc = await call('seed_account', { key: 'accueil-1' });
check('identifiants de persona', acc.json.email === 'testeur+seed-accueil-1@example.com' && acc.json.password === 'Seed-Password-1', acc.isError ? acc.text : acc.json.email);

const multi = await call('db_query', { sql: 'SELECT 1; DROP TABLE users' });
check('db_query refuse plusieurs instructions', multi.isError && /Une seule instruction/.test(multi.text));

const bad = await call('report_write', { markdown: `# Rapport\n\n## Verdict\n${'x'.repeat(250)}` });
check('report_write refuse un rapport incomplet', !bad.isError && bad.json.ok === false && bad.json.missing.length === REQUIRED_SECTIONS.length - 1);

const full = REQUIRED_SECTIONS.map((s) => `## ${s}\nContenu de test.`).join('\n\n') + '\n'.repeat(1) + 'x'.repeat(200);
const good = await call('report_write', { markdown: full });
check('report_write accepte un rapport complet', good.json.ok === true, good.json.path);

await client.close();
rmSync(path.join(ROOT, good.json.path ? path.dirname(good.json.path) : 'reports/none'), { recursive: true, force: true });
if (existsSync(path.join(ROOT, '.state', 'current.json'))) rmSync(path.join(ROOT, '.state', 'current.json'));
console.log(failed ? `\n${failed} échec(s)` : '\nTout est OK');
process.exit(failed ? 1 : 0);
