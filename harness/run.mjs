/**
 * État d'une session de test: identifiant, marqueur, journal, instantanés, rapport.
 * Tout vit dans reports/<run>/ (ignoré par git).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { ROOT, cfg, frontUrl, FRONTS } from './config.mjs';

const POINTER = path.join(ROOT, '.state', 'current.json');

export const REQUIRED_SECTIONS = [
  'Verdict',
  'Parcours',
  'Données créées, modifiées, supprimées',
  'État rencontré',
  'Impact de l’état sur la mission',
  'Frictions',
  'Bugs et incohérences',
  'Évaluation de l’utilisabilité',
  'Limites de l’évaluation',
  'Suggestions',
];

const normalize = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

export function startRun({ persona, mission, behavior }) {
  const id = randomBytes(2).toString('hex');
  const dir = path.join(ROOT, 'reports', `${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}-${id}`);
  mkdirSync(path.join(dir, 'snapshots'), { recursive: true });
  mkdirSync(path.join(dir, 'captures'), { recursive: true });
  const now = new Date();
  const run = {
    runId: id,
    marker: `[QA-${id}]`,
    startedAt: now.toISOString(),
    dir,
    persona,
    mission,
    behavior: behavior ?? null,
    actions: 0,
    maxActions: cfg.maxActions,
  };
  writeFileSync(POINTER, JSON.stringify(run, null, 2));
  writeFileSync(
    path.join(dir, 'journal.md'),
    `# Journal de session ${run.marker}\n\n- Persona: ${persona}\n- Mission: ${mission}\n- Comportement: ${behavior ?? 'naturel'}\n- Début: ${run.startedAt}\n\n`,
  );
  return run;
}

export function currentRun() {
  if (!existsSync(POINTER)) throw new Error('Aucune session en cours: appeler run_start d’abord.');
  return JSON.parse(readFileSync(POINTER, 'utf8'));
}

const save = (run) => writeFileSync(POINTER, JSON.stringify(run, null, 2));

export function describeRun(run) {
  const now = new Date();
  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  return {
    runId: run.runId,
    marker: run.marker,
    reportDir: path.relative(ROOT, run.dir),
    today: `${days[now.getDay()]} ${now.toISOString().slice(0, 10)}`,
    now: now.toISOString(),
    maxActions: run.maxActions,
    urls: Object.fromEntries(FRONTS.map((f) => [f, frontUrl(f)])),
    rules: [
      `Tout ce que tu crées porte le marqueur ${run.marker} dans son nom/titre, et les adresses e-mail passent par run_alias.`,
      'Tu ne supprimes que ce que la mission demande de supprimer, jamais ce qui existait avant.',
      'Tu agis uniquement par l’interface web. Les outils db_/redis_/mail_ servent à constater, pas à agir.',
    ],
  };
}

export function alias(label) {
  const run = currentRun();
  const [local, host] = cfg.mailbox.split('@');
  const safe = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${local}+qa-${run.runId}-${safe}@${host}`;
}

export function journal({ kind, text, evidence }) {
  const run = currentRun();
  if (kind === 'action') run.actions += 1;
  save(run);
  const time = new Date().toISOString().slice(11, 19);
  appendFileSync(
    path.join(run.dir, 'journal.md'),
    `- \`${time}\` **${kind}** — ${text}${evidence ? `\n  - preuve: ${evidence}` : ''}\n`,
  );
  const left = run.maxActions - run.actions;
  return {
    actions: run.actions,
    remaining: left,
    warning: left <= 0 ? 'Budget d’actions épuisé: arrête d’explorer et rédige le rapport avec report_write.' : undefined,
  };
}

export function snapshot(label, results) {
  const run = currentRun();
  const file = path.join(run.dir, 'snapshots', `${label}.json`);
  writeFileSync(file, JSON.stringify({ label, takenAt: new Date().toISOString(), results }, null, 2));
  return path.relative(ROOT, file);
}

export function snapshotDiff(before, after) {
  const run = currentRun();
  const read = (l) => JSON.parse(readFileSync(path.join(run.dir, 'snapshots', `${l}.json`), 'utf8')).results;
  const a = read(before);
  const b = read(after);
  const out = {};
  for (const name of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const keyed = (rows = []) => new Map(rows.map((r) => [JSON.stringify(r), r]));
    const ra = keyed(a[name]);
    const rb = keyed(b[name]);
    out[name] = {
      ajoutés: [...rb].filter(([k]) => !ra.has(k)).map(([, v]) => v),
      retirés: [...ra].filter(([k]) => !rb.has(k)).map(([, v]) => v),
      inchangés: [...ra].filter(([k]) => rb.has(k)).length,
    };
  }
  return out;
}

export function writeReport(markdown) {
  const run = currentRun();
  const headings = [...markdown.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => normalize(m[1]));
  const missing = REQUIRED_SECTIONS.filter((s) => !headings.some((h) => h.startsWith(normalize(s))));
  if (missing.length) return { ok: false, missing };
  const file = path.join(run.dir, 'rapport.md');
  writeFileSync(file, markdown);
  return { ok: true, path: path.relative(ROOT, file), actions: run.actions };
}
