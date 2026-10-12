import { cfg, mailboxAlias } from '../../harness/config.mjs';
import { findUserByEmail, must } from '../../harness/seedapi.mjs';

/**
 * Comptes. Clé naturelle: la clé du seed, qui donne l'adresse (alias de la boîte de test: les e-mails arrivent bien).
 * Additif: crée ce qui manque, corrige nom/prénom, ajoute les rôles manquants. Ne retire ni ne supprime jamais rien.
 */
export const name = 'users';

export const emailOf = (key) => mailboxAlias(`seed-${key}`);

export async function sync(ctx, items, { dryRun, resetPasswords }) {
  const report = [];
  ctx.users = new Map();
  for (const item of items) {
    const email = emailOf(item.key);
    let user = await findUserByEmail(email);
    if (!user) {
      report.push({ op: 'create', key: item.key, detail: email });
      if (dryRun) { ctx.users.set(item.key, { id: null, roles: [] }); continue; }
      await must('POST', '/bff/admin/users', {
        email,
        first_name: item.first_name,
        last_name: item.last_name,
        password: cfg.seedPassword,
        ...(item.phone ? { phone_number: item.phone, phone_country: item.phone_country ?? 'FR' } : {}),
      });
      user = await findUserByEmail(email);
      if (!user) throw new Error(`Compte créé mais introuvable: ${email}`);
    } else {
      const drift = user.first_name !== item.first_name || user.last_name !== item.last_name;
      report.push({ op: drift ? 'update' : 'ok', key: item.key, detail: drift ? 'nom/prénom' : undefined });
      if (drift && !dryRun) await must('PATCH', `/bff/admin/users/${user.id}`, { first_name: item.first_name, last_name: item.last_name });
      if (resetPasswords && !dryRun) {
        await must('PATCH', `/bff/admin/users/${user.id}/password`, { new_password: cfg.seedPassword });
        report.push({ op: 'update', key: item.key, detail: 'mot de passe réinitialisé' });
      }
    }
    if (!user) continue;
    ctx.users.set(item.key, user);
    const have = new Set((user.roles ?? []).map((r) => r.name.toLowerCase()));
    for (const roleName of item.roles ?? []) {
      if (have.has(roleName.toLowerCase())) continue;
      const role = ctx.roles?.get(roleName.toLowerCase());
      if (!role) { report.push({ op: 'warn', key: item.key, detail: `rôle inconnu: ${roleName}` }); continue; }
      report.push({ op: 'update', key: item.key, detail: `+ rôle ${roleName}` });
      if (!dryRun) await must('POST', `/bff/admin/users/${user.id}/roles`, { role_id: role.id });
    }
  }
  return report;
}
