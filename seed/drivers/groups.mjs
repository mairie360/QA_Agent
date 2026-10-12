import { must } from '../../harness/seedapi.mjs';

/** Groupes (services) et leurs membres. Clé naturelle: name. Additif: crée le groupe, ajoute les membres manquants. */
export const name = 'groups';

export async function sync(ctx, items, { dryRun }) {
  const report = [];
  const list = async () => (await must('GET', '/bff/admin/groups?limit=500', undefined, [200])).groups;
  let existing = new Map((await list()).map((g) => [g.name.toLowerCase(), g]));
  for (const item of items) {
    let group = existing.get(item.name.toLowerCase());
    if (!group) {
      report.push({ op: 'create', key: item.name });
      if (dryRun) continue;
      await must('POST', '/bff/admin/groups', { name: item.name, description: item.description ?? '' });
      existing = new Map((await list()).map((g) => [g.name.toLowerCase(), g]));
      group = existing.get(item.name.toLowerCase());
    } else {
      report.push({ op: 'ok', key: item.name });
    }
    if (!group) continue;
    const members = new Set(((await must('GET', `/bff/admin/groups/${group.id}/users`, undefined, [200])).users ?? []).map((u) => u.id));
    for (const memberKey of item.members ?? []) {
      const user = ctx.users?.get(memberKey);
      if (!user) { report.push({ op: 'warn', key: item.name, detail: `membre inconnu du seed: ${memberKey}` }); continue; }
      if (user.id !== null && members.has(user.id)) continue;
      report.push({ op: 'update', key: item.name, detail: `+ membre ${memberKey}` });
      if (!dryRun && user.id !== null) await must('POST', `/bff/admin/groups/${group.id}/users`, { user_id: user.id }, [200, 201, 204, 409]);
    }
  }
  return report;
}
