#!/usr/bin/env node
/**
 * Seed du staging pour l'agent testeur — HORS agent, lancé par un dev.
 *
 *   npm run seed:plan -- --env dev    ce qui serait créé/corrigé (lectures seules); --env staging|dev, sinon QA_ENV
 *   npm run seed:apply                applique
 *   npm run seed:apply -- --reset-passwords   remet aussi le mot de passe commun (QA_SEED_PASSWORD) aux comptes de seed
 *   npm run seed:status               version du seed et dernière application
 *
 * Idempotent et ADDITIF: relancer ne crée rien de plus, ne supprime jamais rien, ne touche pas ce que l'agent a créé.
 * Le staging n'a pas à être propre: le seed complète, l'agent doit de toute façon fonctionner sur un état quelconque.
 * Évolution: modifier/ajouter dans seed/data/*.yaml, incrémenter `version` dans manifest.yaml, noter dans CHANGELOG.md.
 * Nouveau type d'objet (calendrier, projets…): ajouter un pilote dans seed/drivers/ et le déclarer dans DRIVERS ci-dessous.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { ROOT, cfg, currentEnv, selectEnv } from '../harness/config.mjs';
import * as roles from './drivers/roles.mjs';
import * as users from './drivers/users.mjs';
import * as groups from './drivers/groups.mjs';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
// Ordre = dépendances (les utilisateurs ont besoin des rôles, les groupes des utilisateurs).
const DRIVERS = [roles, users, groups];

const load = (file) => (existsSync(path.join(DATA, file)) ? YAML.parse(readFileSync(path.join(DATA, file), 'utf8')) : null);

const [cmd = 'plan', ...flags] = process.argv.slice(2);
const envFlag = flags.indexOf('--env');
if (envFlag >= 0) selectEnv(flags[envFlag + 1]);
const APPLIED = path.join(ROOT, '.state', `seed-applied-${currentEnv()}.json`);
const manifest = load('manifest.yaml');

if (cmd === 'status') {
  const applied = existsSync(APPLIED) ? JSON.parse(readFileSync(APPLIED, 'utf8')) : null;
  console.log(`Environnement: ${currentEnv()} (${cfg.domain})\nSeed du dépôt: version ${manifest.version}`);
  console.log(applied ? `Dernière application ici: version ${applied.version} le ${applied.at}` : 'Jamais appliqué depuis ce poste.');
  process.exit(0);
}
if (!['plan', 'apply'].includes(cmd)) {
  console.error('usage: seed.mjs plan | apply [--reset-passwords] | status   (+ --env staging|dev)');
  process.exit(1);
}

const dryRun = cmd === 'plan';
const ctx = {};
let warnings = 0;
console.log(`${dryRun ? 'PLAN' : 'APPLICATION'} du seed version ${manifest.version} sur ${currentEnv()} (${cfg.domain})\n`);
for (const driver of DRIVERS) {
  const items = load(`${driver.name}.yaml`)?.items ?? [];
  const report = await driver.sync(ctx, items, { dryRun, resetPasswords: flags.includes('--reset-passwords') });
  const count = (op) => report.filter((r) => r.op === op).length;
  console.log(`${driver.name}: ${items.length} dans le seed — ${count('create')} à créer, ${count('update')} à corriger, ${count('ok')} déjà conformes`);
  for (const r of report.filter((x) => x.op !== 'ok')) {
    if (r.op === 'warn') warnings += 1;
    console.log(`   ${{ create: '+', update: '~', warn: '!' }[r.op]} ${r.key}${r.detail ? ` (${r.detail})` : ''}`);
  }
}
if (!dryRun) {
  mkdirSync(path.dirname(APPLIED), { recursive: true });
  writeFileSync(APPLIED, JSON.stringify({ version: manifest.version, at: new Date().toISOString() }));
}
console.log(warnings ? `\n${warnings} avertissement(s) à examiner.` : '\nTerminé.');
