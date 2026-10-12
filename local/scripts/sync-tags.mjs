#!/usr/bin/env node
/**
 * Écrit local/images.env: les images de TOUTE la stack, aux étiquettes déployées sur l'environnement de dev (dépôt Deploiment).
 * Il n'existe pas d'étiquette « latest » (elle n'est plus publiée): il faut des étiquettes précises, d'où ce script.
 *
 *   node local/scripts/sync-tags.mjs                     lit dev/values.yaml sur GitHub (dépôt public)
 *   node local/scripts/sync-tags.mjs --file <values.yaml>  lit un fichier local (clone de Deploiment)
 *   node local/scripts/sync-tags.mjs --env staging         étiquettes de staging au lieu de dev
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : undefined);
const env = flag('env') ?? 'dev';
const file = flag('file');

const url = `https://raw.githubusercontent.com/mairie360/Deploiment/main/clusters/mairie360/instances/${env}/values.yaml`;
const text = file ? readFileSync(file, 'utf8') : await (async () => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
})();
const values = YAML.parse(text);

const lines = [`# Généré par local/scripts/sync-tags.mjs depuis ${file ?? url} — ne pas éditer à la main.`];
const add = (name, repository, tag) => {
  if (!tag) throw new Error(`étiquette manquante pour ${name}`);
  lines.push(`${name}=${repository}:${tag}`);
};

add('DATABASE_IMAGE', values.database?.image?.repository ?? 'ghcr.io/mairie360/database', values.database?.image?.tag);
add('LIQUIBASE_IMAGE', values.liquibase?.image?.repository ?? 'ghcr.io/mairie360/liquibase-migrations', values.liquibase?.image?.tag);
for (const group of ['APIs', 'BFFs', 'Fronts']) {
  for (const [name, cfg] of Object.entries(values[group]?.instances ?? {})) {
    if (cfg.enabled === false) continue;
    add(`${name.toUpperCase().replace(/-/g, '_')}_IMAGE`, cfg.image.repository, cfg.image.tag);
  }
}
writeFileSync(path.join(here, '..', 'images.env'), `${lines.join('\n')}\n`);
console.log(`${lines.length - 1} images écrites dans local/images.env (${env})`);
