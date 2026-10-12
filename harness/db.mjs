/**
 * Observation de la base de staging, en LECTURE SEULE.
 * Trois verrous: rôle Postgres SELECT seul (sql/readonly-role.sql), transaction READ ONLY, une seule instruction.
 * Les colonnes secrètes sont masquées (on voit le préfixe du hash, pas sa valeur).
 */
import pg from 'pg';
import { cfg } from './config.mjs';

const SECRET_COLUMNS = /^(password|token_hash|refresh_token|secret|.*_secret)$/i;

function redact(row) {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, SECRET_COLUMNS.test(k) && typeof v === 'string' ? `<${v.slice(0, 10)}… ${v.length} car.>` : v]),
  );
}

export async function query(sql, params = []) {
  const trimmed = sql.trim().replace(/;$/, '');
  if (trimmed.includes(';')) throw new Error('Une seule instruction par requête.');
  const client = new pg.Client({ ...cfg.db, statement_timeout: 10_000, connectionTimeoutMillis: 8_000 });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const result = await client.query(trimmed, params);
    return result.rows.slice(0, 200).map(redact);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }
}

export const tables = () =>
  query(`SELECT table_schema, table_name, table_type FROM information_schema.tables
         WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2`);

export const describe = (table) =>
  query(`SELECT table_schema, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [table]);
