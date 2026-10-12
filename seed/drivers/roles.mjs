import { must } from '../../harness/seedapi.mjs';

/** Rôles supplémentaires (les cinq rôles de base existent déjà). Clé naturelle: name. */
export const name = 'roles';

export async function sync(ctx, items, { dryRun }) {
  const existing = (await must('GET', '/bff/admin/roles', undefined, [200])).roles;
  ctx.roles = new Map(existing.map((r) => [r.name.toLowerCase(), r]));
  const report = [];
  for (const item of items) {
    if (ctx.roles.has(item.name.toLowerCase())) { report.push({ op: 'ok', key: item.name }); continue; }
    report.push({ op: 'create', key: item.name });
    if (dryRun) continue;
    await must('POST', '/bff/admin/roles', { name: item.name, description: item.description ?? '', can_be_deleted: item.can_be_deleted ?? true });
    const fresh = (await must('GET', '/bff/admin/roles', undefined, [200])).roles;
    ctx.roles = new Map(fresh.map((r) => [r.name.toLowerCase(), r]));
  }
  return report;
}
