/**
 * État d'une session de test: environnement, identifiant, marqueur, journal, instantanés, rapport.
 * Deux modes: « mission » (une persona joue une mission écrite) et « feature » (un dev décrit une fonctionnalité à vérifier).
 * Tout vit dans reports/<run>/ (ignoré par git).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { ROOT, cfg, currentEnv, frontUrl, FRONTS, selectEnv } from './config.mjs';

const POINTER = path.join(ROOT, '.state', 'current.json');

export const MISSION_SECTIONS = [
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

export const FEATURE_SECTIONS = [
  'Verdict',
  'Compréhension de la demande',
  'Cas testés',
  'Données créées, modifiées, supprimées',
  'État rencontré',
  'Frictions',
  'Bugs et incohérences',
  'Régressions possibles',
  'Limites de l’évaluation',
  'Suggestions',
];

export const REQUIRED_SECTIONS = MISSION_SECTIONS; // conservé pour les tests existants
export const sectionsFor = (mode) => (mode === 'feature' ? FEATURE_SECTIONS : MISSION_SECTIONS);

const normalize = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

export function startRun({ mode = 'mission', persona, mission, feature, behavior, env }) {
  if (env) selectEnv(env);
  if (mode === 'feature' && !feature) throw new Error('Mode feature: décris la fonctionnalité à vérifier (paramètre feature).');
  if (mode === 'mission' && (!persona || !mission)) throw new Error('Mode mission: persona et mission sont obligatoires.');
  const id = randomBytes(2).toString('hex');
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const dir = path.join(ROOT, 'reports', `${stamp}-${currentEnv()}-${id}`);
  mkdirSync(path.join(dir, 'snapshots'), { recursive: true });
  mkdirSync(path.join(dir, 'captures'), { recursive: true });
  const run = {
    runId: id,
    marker: `[QA-${id}]`,
    env: currentEnv(),
    mode,
    startedAt: new Date().toISOString(),
    dir,
    persona: persona ?? null,
    mission: mission ?? null,
    feature: feature ?? null,
    behavior: behavior ?? null,
    actions: 0,
    maxActions: cfg.maxActions,
  };
  writeFileSync(POINTER, JSON.stringify(run, null, 2));
  writeFileSync(
    path.join(dir, 'journal.md'),
    `# Journal de session ${run.marker}\n\n- Environnement: ${run.env} (${cfg.domain})\n- Mode: ${mode}\n`
      + (mode === 'feature'
        ? `- Fonctionnalité à vérifier: ${feature}\n`
        : `- Persona: ${persona}\n- Mission: ${mission}\n`)
      + `- Comportement: ${behavior ?? 'naturel'}\n- Début: ${run.startedAt}\n\n`,
  );
  return run;
}

export function currentRun() {
  if (!existsSync(POINTER)) throw new Error('Aucune session en cours: appeler run_start d’abord.');
  const run = JSON.parse(readFileSync(POINTER, 'utf8'));
  selectEnv(run.env); // si le serveur redémarre en cours de session, on reste sur le bon environnement
  return run;
}

const save = (run) => writeFileSync(POINTER, JSON.stringify(run, null, 2));

export function describeRun(run) {
  const now = new Date();
  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  return {
    runId: run.runId,
    marker: run.marker,
    env: run.env,
    mode: run.mode,
    domain: cfg.domain,
    reportDir: path.relative(ROOT, run.dir),
    today: `${days[now.getDay()]} ${now.toISOString().slice(0, 10)}`,
    now: now.toISOString(),
    maxActions: run.maxActions,
    urls: Object.fromEntries(FRONTS.map((f) => [f, frontUrl(f)])),
    reportSections: sectionsFor(run.mode),
    rules: [
      `Tu es sur l’environnement ${run.env} (${cfg.domain}) et nulle part ailleurs.`,
      `Tout ce que tu crées porte le marqueur ${run.marker} dans son nom/titre, et les adresses e-mail passent par run_alias.`,
      'Tu ne supprimes que ce que la mission/la vérification demande de supprimer, jamais ce qui existait avant.',
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
  const missing = sectionsFor(run.mode).filter((s) => !headings.some((h) => h.startsWith(normalize(s))));
  if (missing.length) return { ok: false, mode: run.mode, missing };
  const file = path.join(run.dir, 'rapport.md');
  writeFileSync(file, markdown);
  return { ok: true, path: path.relative(ROOT, file), env: run.env, actions: run.actions };
}
