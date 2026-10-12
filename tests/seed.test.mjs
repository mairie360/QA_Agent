#!/usr/bin/env node
/**
 * Le seed contre un faux BFF d'administration en mémoire: création, idempotence, évolution (ajout), aucune suppression.
 * `node tests/seed.test.mjs` — aucun réseau, aucun staging.
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, cpSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = {
  nextId: 100,
  roles: [{ id: 1, name: 'Admin' }, { id: 2, name: 'Maire' }, { id: 3, name: 'Responsable' }, { id: 4, name: 'User' }, { id: 5, name: 'Guest' }],
  users: [],
  groups: [],
  members: new Map(),
};
let calls = [];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let body = '';
  for await (const c of req) body += c;
  const json = body ? JSON.parse(body) : {};
  const send = (status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(data === undefined ? '' : JSON.stringify(data)); };
  calls.push(`${req.method} ${url.pathname}`);
  const p = url.pathname;
  let m;
  if (p === '/api/auth/login') { res.writeHead(200, { 'set-cookie': 'accessToken=tok; HttpOnly', 'content-type': 'application/json' }); return res.end('{}'); }
  if (req.headers.authorization !== 'Bearer tok') return send(401, {});
  if (p === '/bff/admin/roles' && req.method === 'GET') return send(200, { roles: db.roles });
  if (p === '/bff/admin/roles' && req.method === 'POST') { db.roles.push({ id: ++db.nextId, name: json.name }); return send(201, {}); }
  if (p === '/bff/admin/users' && req.method === 'GET') {
    const q = (url.searchParams.get('search') ?? '').toLowerCase();
    return send(200, { users: db.users.filter((u) => u.email.toLowerCase().includes(q)), page: 1, page_size: 50, total: 0, total_pages: 1 });
  }
  if (p === '/bff/admin/users' && req.method === 'POST') {
    if (db.users.some((u) => u.email === json.email)) return send(409, {});
    db.users.push({ id: ++db.nextId, email: json.email, first_name: json.first_name, last_name: json.last_name, roles: [] });
    return send(201, {});
  }
  if ((m = p.match(/^\/bff\/admin\/users\/(\d+)$/)) && req.method === 'PATCH') { Object.assign(db.users.find((u) => u.id === +m[1]), json); return send(200, {}); }
  if ((m = p.match(/^\/bff\/admin\/users\/(\d+)\/roles$/)) && req.method === 'POST') {
    const u = db.users.find((x) => x.id === +m[1]);
    const r = db.roles.find((x) => x.id === json.role_id);
    u.roles.push({ id: r.id, name: r.name });
    return send(200, {});
  }
  if (p === '/bff/admin/groups' && req.method === 'GET') return send(200, { groups: db.groups });
  if (p === '/bff/admin/groups' && req.method === 'POST') { db.groups.push({ id: ++db.nextId, name: json.name, description: json.description, owner_id: 1 }); return send(201, {}); }
  if ((m = p.match(/^\/bff\/admin\/groups\/(\d+)\/users$/))) {
    const set = db.members.get(+m[1]) ?? new Set();
    if (req.method === 'GET') return send(200, { users: [...set].map((id) => ({ id })) });
    set.add(json.user_id); db.members.set(+m[1], set); return send(201, {});
  }
  return send(404, { path: p });
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

// Copie du seed pour pouvoir l'« faire évoluer » sans toucher au vrai.
const tmp = mkdtempSync(path.join(tmpdir(), 'seed-'));
cpSync(path.join(ROOT, 'seed'), path.join(tmp, 'seed'), { recursive: true });
cpSync(path.join(ROOT, 'harness'), path.join(tmp, 'harness'), { recursive: true });
cpSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'), { recursive: true });
writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');

const env = { ...process.env, QA_API_BASE: base, QA_ADMIN_EMAIL: 'a@b.c', QA_ADMIN_PASSWORD: 'x', QA_SEED_PASSWORD: 'Seed-Password-1', QA_MAILBOX: 'testeur@example.com', QA_DOMAIN: 'staging.mairie360-eip.fr' };
// Asynchrone: le faux BFF tourne dans ce processus, un spawnSync le figerait.
const seed = (...args) =>
  new Promise((resolve) => {
    calls = [];
    const child = spawn(process.execPath, [path.join(tmp, 'seed', 'seed.mjs'), ...args], { env });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ out, code, writes: calls.filter((c) => !c.startsWith('GET') && !c.endsWith('/api/auth/login')).length }));
  });

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`  ${ok ? 'OK    ' : 'ECHEC '} ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed += 1; };

let r = await seed('plan');
check('plan: aucune écriture', r.code === 0 && r.writes === 0 && db.users.length === 0, r.out.split('\n').find((l) => l.startsWith('users')));
r = await seed('apply');
check('apply crée comptes, groupes, rôle', r.code === 0 && db.users.length === 14 && db.groups.length === 5 && db.roles.length === 6, `${db.users.length} comptes, ${db.groups.length} groupes`);
const rhRoles = db.users.find((u) => u.email.includes('seed-rh-1@') || u.email.includes('seed-rh-1'))?.roles.map((x) => x.name).sort().join(',');
check('rôles attribués', rhRoles === 'Référent numérique,User', rhRoles);
check('alias de la boîte de test', db.users.every((u) => /^testeur\+seed-[a-z0-9-]+@example\.com$/.test(u.email)), db.users[0].email);
check('membres des groupes', [...db.members.values()].reduce((n, s) => n + s.size, 0) === 12, `${[...db.members.values()].reduce((n, s) => n + s.size, 0)} adhésions`);

const before = JSON.stringify({ u: db.users, g: db.groups, m: [...db.members].map(([k, v]) => [k, [...v]]) });
r = await seed('apply');
check('2e apply: idempotent (aucune écriture)', r.code === 0 && r.writes === 0, `${r.writes} écriture(s)`);
check('2e apply: état identique', before === JSON.stringify({ u: db.users, g: db.groups, m: [...db.members].map(([k, v]) => [k, [...v]]) }));

// Trace d'un run précédent + objet de l'agent: le seed n'y touche pas.
db.users.push({ id: 900, email: 'testeur+qa-ab12-visiteur@example.com', first_name: 'QA', last_name: 'Visiteur', roles: [] });
db.groups.push({ id: 901, name: 'Réunion [QA-ab12]', description: '', owner_id: 1 });
// Évolution du seed: un agent de plus, une dérive de nom.
const users = readFileSync(path.join(tmp, 'seed/data/users.yaml'), 'utf8') + "  - { key: urbanisme-2, first_name: Élodie, last_name: Roche, roles: [User] }\n";
writeFileSync(path.join(tmp, 'seed/data/users.yaml'), users);
db.users.find((u) => u.email.includes('seed-maire@')).last_name = 'Modifié';
r = await seed('apply');
check('évolution: 1 compte ajouté, 1 nom corrigé', db.users.length === 14 + 1 + 1 && db.users.find((u) => u.email.includes('seed-maire@')).last_name === 'Marchand', `${db.users.length} comptes`);
check('traces des runs précédents intactes', db.users.some((u) => u.id === 900) && db.groups.some((g) => g.id === 901));
check('aucune suppression', !calls.some((c) => c.startsWith('DELETE')));

server.close();
rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} échec(s)` : '\nTout est OK');
process.exit(failed ? 1 : 0);
