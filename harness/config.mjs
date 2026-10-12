import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Environnements cibles. Seuls staging et dev existent ici: jamais la production.
 * Les secrets de chaque environnement vivent dans .env.<env> (mots de passe de base, Redis, admin, seed);
 * .env porte ce qui est commun (boîte de test, clé Resend, environnement par défaut).
 */
export const PROFILES = {
  staging: { domain: 'staging.mairie360-eip.fr', kubeContext: 'staging', namespace: 'mairie360-staging', release: 'staging', dbName: 'mairie_db_staging', dbPort: 55432, redisPort: 55379 },
  dev: { domain: 'dev.mairie360-eip.fr', kubeContext: 'dev', namespace: 'mairie360-dev', release: 'dev', dbName: 'mairie_db_dev', dbPort: 56432, redisPort: 56379 },
};

function parseDotenv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.trimStart().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

const common = parseDotenv(path.join(ROOT, '.env'));
const perEnv = Object.fromEntries(Object.keys(PROFILES).map((name) => [name, parseDotenv(path.join(ROOT, `.env.${name}`))]));

let active = process.env.QA_ENV || common.QA_ENV || 'staging';
if (!PROFILES[active]) throw new Error(`QA_ENV=${active} inconnu (staging ou dev).`);

export const currentEnv = () => active;

/** Change d'environnement en cours de route (run_start, --env du seed). */
export function selectEnv(name) {
  if (!PROFILES[name]) throw new Error(`Environnement inconnu: ${name} (staging ou dev).`);
  active = name;
  return active;
}

// Ordre: variable du shell, .env.<env>, .env, valeur par défaut du profil.
const val = (key, fallback) => {
  for (const v of [process.env[key], perEnv[active]?.[key], common[key]]) if (v !== undefined && v !== '') return v;
  return fallback;
};

export function need(key) {
  const value = val(key);
  if (!value) throw new Error(`Variable ${key} manquante pour l’environnement ${active} (voir .env.example, .env.${active})`);
  return value;
}

export const FRONTS = ['login', 'dashboard', 'project', 'calendar', 'message', 'settings', 'elearning', 'admin'];

export const cfg = {
  get env() { return active; },
  get profile() { return PROFILES[active]; },
  get domain() {
    const domain = val('QA_DOMAIN', PROFILES[active].domain);
    // Garde-fou: jamais autre chose que staging/dev.
    if (!/^(staging|dev)\./.test(domain) && val('QA_ALLOW_ANY_ENV') !== 'true') {
      throw new Error(`QA_DOMAIN=${domain} n'est pas un environnement staging/dev: refus.`);
    }
    return domain;
  },
  get apiFront() { return val('QA_API_FRONT', 'admin'); },
  get maxActions() { return Number(val('QA_MAX_ACTIONS', '150')); },
  get adminEmail() { return need('QA_ADMIN_EMAIL'); },
  get adminPassword() { return need('QA_ADMIN_PASSWORD'); },
  get seedPassword() { return need('QA_SEED_PASSWORD'); },
  get mailbox() { return need('QA_MAILBOX'); },
  get resendKey() { return need('RESEND_API_KEY'); },
  db: {
    get host() { return val('QA_DB_HOST', '127.0.0.1'); },
    get port() { return Number(val('QA_DB_PORT', String(PROFILES[active].dbPort))); },
    get database() { return val('QA_DB_NAME', PROFILES[active].dbName); },
    get user() { return val('QA_DB_USER', 'qa_readonly'); },
    get password() { return need('QA_DB_PASSWORD'); },
  },
  redis: {
    get host() { return val('QA_REDIS_HOST', '127.0.0.1'); },
    get port() { return Number(val('QA_REDIS_PORT', String(PROFILES[active].redisPort))); },
    get username() { return val('QA_REDIS_USERNAME', 'admin'); },
    get password() { return need('QA_REDIS_PASSWORD'); },
  },
};

export const frontUrl = (name) => `https://${name}.${cfg.domain}`;

/** Alias de la boîte de test: vous+<tag>@domaine. */
export function mailboxAlias(tag) {
  const [local, host] = cfg.mailbox.split('@');
  return `${local}+${tag.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}@${host}`;
}
