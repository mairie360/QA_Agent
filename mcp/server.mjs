#!/usr/bin/env node
/**
 * Serveur MCP « qa-observer »: les outils de l'agent testeur qui ne sont PAS le navigateur.
 *  - cadre de la session: run_start, run_alias, journal, report_write
 *  - observation en lecture seule: db_*, redis_read, mail_wait
 *  - effets d'une session: snapshot, snapshot_diff
 * Aucun outil n'écrit dans l'application: les actions passent par l'interface web (Playwright MCP).
 * Transport stdio: Claude Code/Desktop, Codex CLI, Cursor, SDK Agents d'OpenAI…
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { REQUIRED_SECTIONS, alias, describeRun, journal, snapshot, snapshotDiff, startRun, writeReport, currentRun } from '../harness/run.mjs';
import { describe, query, tables } from '../harness/db.mjs';
import { redis } from '../harness/redis.mjs';
import { waitForMail } from '../harness/mail.mjs';
import { cfg } from '../harness/config.mjs';
import { emailOf } from '../seed/drivers/users.mjs';

const server = new McpServer({ name: 'qa-observer', version: '1.0.0' });

const text = (value) => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] });
const fail = (e) => ({ isError: true, content: [{ type: 'text', text: String(e?.message ?? e) }] });
const safe = (fn) => async (args) => {
  try { return text(await fn(args)); } catch (e) { return fail(e); }
};

server.registerTool(
  'run_start',
  {
    description: 'À appeler EN PREMIER. Ouvre une session de test: crée l’identifiant, le marqueur [QA-xxxx] à mettre dans tout ce que tu crées, le journal, et donne la date du jour (pour les dates relatives) et les URL des fronts.',
    inputSchema: {
      persona: z.string().describe('Nom de la persona jouée'),
      mission: z.string().describe('Mission en une phrase'),
      behavior: z.string().optional().describe('Trait de comportement (pressé, hésitant, lit peu…)'),
    },
  },
  safe((a) => describeRun(startRun(a))),
);

server.registerTool(
  'run_alias',
  {
    description: 'Adresse e-mail unique pour un compte que tu crées dans cette session (alias de la vraie boîte de test, les e-mails arrivent bien). Un compte supprimé reste archivé: ne réutilise jamais une adresse.',
    inputSchema: { label: z.string().describe('Court libellé: nouvel-arrivant, invite-1…') },
  },
  safe(({ label }) => alias(label)),
);

server.registerTool(
  'seed_account',
  {
    description: 'Identifiants d’un compte du seed (staging): « admin » pour l’administrateur de base, ou la clé d’une persona (ex. accueil-1, rh-resp, nouvel-arrivant, voir seed/data/users.yaml). Ne recopie jamais ces identifiants dans le journal ni le rapport. Si la connexion échoue (mot de passe changé par un run précédent), c’est à toi de t’en sortir par l’interface: connecte-toi en admin et réinitialise le mot de passe depuis l’écran d’administration, puis note-le comme friction/donnée.',
    inputSchema: { key: z.string() },
  },
  safe(({ key }) => (key === 'admin'
    ? { email: cfg.adminEmail, password: cfg.adminPassword }
    : { email: emailOf(key), password: cfg.seedPassword, note: 'Compte du seed: première connexion = changement de mot de passe forcé, sauf si un run précédent l’a déjà fait.' })),
);

server.registerTool(
  'journal',
  {
    description: 'Note ce que tu fais et ce que tu constates. kind: action (chaque action sur l’interface), observation (ce que tu vois), friction (gêne d’usage), bug (erreur, incohérence), data (objet créé/modifié/supprimé, avec son nom exact), note. Appelle-le après CHAQUE action; le rapport final s’appuie dessus.',
    inputSchema: {
      kind: z.enum(['action', 'observation', 'friction', 'bug', 'data', 'note']),
      text: z.string().describe('Ce que tu as fait/vu, en une ou deux phrases'),
      evidence: z.string().optional().describe('Preuve: chemin de capture, URL, extrait de message d’erreur'),
    },
  },
  safe(journal),
);

server.registerTool(
  'db_tables',
  { description: 'Observation (lecture seule): liste des tables et vues de la base de staging.', inputSchema: {} },
  safe(() => tables()),
);

server.registerTool(
  'db_describe',
  { description: 'Observation (lecture seule): colonnes d’une table.', inputSchema: { table: z.string() } },
  safe(({ table }) => describe(table)),
);

server.registerTool(
  'db_query',
  {
    description: 'Observation (lecture seule): une requête SELECT sur la base de staging, pour vérifier ce qui s’est vraiment passé derrière l’écran. Une seule instruction, 200 lignes maximum, colonnes secrètes masquées. N’essaie pas de modifier quoi que ce soit.',
    inputSchema: { sql: z.string() },
  },
  safe(({ sql }) => query(sql)),
);

server.registerTool(
  'redis_read',
  {
    description: 'Observation (lecture seule) de Redis: exists | ttl | get | scan. Ex. revoked:<sid> pour vérifier une révocation de session.',
    inputSchema: { command: z.enum(['exists', 'ttl', 'get', 'scan']), key: z.string().describe('Clé, ou motif pour scan') },
  },
  safe(({ command, key }) => redis(command, key)),
);

server.registerTool(
  'mail_wait',
  {
    description: 'Attend un e-mail réellement envoyé par staging à une adresse (via Resend) et renvoie sujet, expéditeur, liens, extrait de texte et statut de remise (delivered, bounced…).',
    inputSchema: {
      to: z.string().describe('Adresse destinataire exacte (utilise celle de run_alias)'),
      subject: z.string().optional().describe('Expression régulière sur le sujet'),
      after: z.string().optional().describe('Date ISO: ignorer les e-mails plus anciens'),
      timeout_s: z.number().int().min(5).max(180).optional(),
    },
  },
  safe(({ to, subject, after, timeout_s }) => waitForMail({ to, subject, after, timeoutS: timeout_s ?? 90 })),
);

server.registerTool(
  'snapshot',
  {
    description: 'Fige l’état de ce qui concerne ta mission (résultats de requêtes SELECT) sous un nom, par ex. « avant » puis « après ». Sert à vérifier les EFFETS de la session (+1 réunion, −1 invité) sans présumer de l’état de départ, qui est inconnu.',
    inputSchema: {
      label: z.string().regex(/^[a-z0-9-]+$/),
      queries: z.array(z.object({ name: z.string(), sql: z.string() })).min(1).max(10),
    },
  },
  safe(async ({ label, queries }) => {
    const results = {};
    for (const q of queries) results[q.name] = await query(q.sql);
    return { saved: snapshot(label, results), counts: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.length])) };
  }),
);

server.registerTool(
  'snapshot_diff',
  {
    description: 'Compare deux instantanés: pour chaque requête, lignes ajoutées, retirées, nombre inchangé. L’écart doit correspondre à la liste de données de la mission, ni plus ni moins.',
    inputSchema: { before: z.string(), after: z.string() },
  },
  safe(({ before, after }) => snapshotDiff(before, after)),
);

server.registerTool(
  'report_write',
  {
    description: `À appeler EN DERNIER: enregistre ton auto-évaluation de la session (Markdown). Elle doit contenir ces sections de niveau 2 (##): ${REQUIRED_SECTIONS.join(' ; ')}. Chaque affirmation renvoie à une ligne du journal, une capture ou une requête. Ce qui n’a pas été vérifié est écrit « non vérifié ».`,
    inputSchema: { markdown: z.string().min(200) },
  },
  safe(({ markdown }) => writeReport(markdown)),
);

server.registerTool(
  'run_status',
  { description: 'État de la session en cours (actions faites, budget restant, dossier du rapport).', inputSchema: {} },
  safe(() => {
    const run = currentRun();
    return { runId: run.runId, marker: run.marker, actions: run.actions, remaining: run.maxActions - run.actions, reportDir: run.dir };
  }),
);

await server.connect(new StdioServerTransport());
