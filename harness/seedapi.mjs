/**
 * Client d'administration RÉSERVÉ AU SEED (hors agent).
 * L'agent testeur n'appelle jamais le BFF ni l'API: il passe par l'interface web. Le seed, lui, prépare le terrain
 * par les routes d'administration du BFF, donc avec les vraies règles métier (hash, validation, miroir Keycloak).
 */
import { cfg, frontUrl } from './config.mjs';

let token;

// Test hors réseau (tests/seed.test.mjs): base de substitution, jamais utilisée en vrai.
const base = (front) => process.env.QA_API_BASE || frontUrl(front);

async function adminToken() {
  if (token) return token;
  const origin = base('login');
  const res = await fetch(`${origin}/api/auth/login`, {
    method: 'POST',
    // La route de connexion du front n'accepte que sa propre page: on reproduit les en-têtes du navigateur.
    headers: { 'content-type': 'application/json', origin, 'sec-fetch-site': 'same-origin' },
    body: JSON.stringify({ email: cfg.adminEmail, password: cfg.adminPassword }),
    redirect: 'manual',
  });
  const cookie = (res.headers.getSetCookie?.() ?? []).map((l) => l.split(';')[0]).find((c) => c.startsWith('accessToken='));
  if (res.status !== 200 || !cookie) throw new Error(`Connexion admin refusée (HTTP ${res.status}). Vérifier QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD.`);
  token = cookie.slice('accessToken='.length);
  return token;
}

export async function admin(method, path, body) {
  const res = await fetch(`${base(cfg.apiFront)}${path}`, {
    method,
    headers: { authorization: `Bearer ${await adminToken()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

export async function must(method, path, body, ok = [200, 201, 204]) {
  const res = await admin(method, path, body);
  if (!ok.includes(res.status)) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(res.data)?.slice(0, 200)}`);
  return res.data;
}

export async function findUserByEmail(email) {
  const data = await must('GET', `/bff/admin/users?search=${encodeURIComponent(email)}&page_size=50`, undefined, [200]);
  return (data.users ?? []).find((u) => u.email.toLowerCase() === email.toLowerCase());
}
