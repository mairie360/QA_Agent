import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadDotenv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.trimStart().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}
loadDotenv(path.join(ROOT, '.env'));

const env = (key, fallback) => (process.env[key] !== undefined && process.env[key] !== '' ? process.env[key] : fallback);

export function need(key) {
  const value = env(key);
  if (!value) throw new Error(`Variable ${key} manquante (voir .env.example)`);
  return value;
}

export const FRONTS = ['login', 'dashboard', 'project', 'calendar', 'message', 'settings', 'elearning', 'admin'];

const domain = env('QA_DOMAIN', 'staging.mairie360-eip.fr');

// Garde-fou: jamais autre chose que staging/dev.
if (!/^(staging|dev)\./.test(domain) && env('QA_ALLOW_ANY_ENV') !== 'true') {
  throw new Error(`QA_DOMAIN=${domain} n'est pas un environnement staging/dev: refus.`);
}

export const cfg = {
  domain,
  apiFront: env('QA_API_FRONT', 'admin'),
  maxActions: Number(env('QA_MAX_ACTIONS', '150')),
  get adminEmail() { return need('QA_ADMIN_EMAIL'); },
  get adminPassword() { return need('QA_ADMIN_PASSWORD'); },
  get seedPassword() { return need('QA_SEED_PASSWORD'); },
  get mailbox() { return need('QA_MAILBOX'); },
  get resendKey() { return need('RESEND_API_KEY'); },
  db: {
    host: env('QA_DB_HOST', '127.0.0.1'),
    port: Number(env('QA_DB_PORT', '55432')),
    database: env('QA_DB_NAME', 'mairie_db_staging'),
    user: env('QA_DB_USER', 'qa_readonly'),
    get password() { return need('QA_DB_PASSWORD'); },
  },
  redis: {
    host: env('QA_REDIS_HOST', '127.0.0.1'),
    port: Number(env('QA_REDIS_PORT', '55379')),
    username: env('QA_REDIS_USERNAME', 'admin'),
    get password() { return need('QA_REDIS_PASSWORD'); },
  },
};

export const frontUrl = (name) => `https://${name}.${cfg.domain}`;

/** Alias de la boîte de test: vous+<tag>@domaine. */
export function mailboxAlias(tag) {
  const [local, host] = cfg.mailbox.split('@');
  return `${local}+${tag.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}@${host}`;
}
