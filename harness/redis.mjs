/**
 * Observation de Redis de staging, en LECTURE SEULE: quatre opérations, pas de commande libre.
 * Les clés sont préfixées par le rôle de l'API (`core-api:…`); la liste de révocation `revoked:<sid>` ne l'est pas.
 */
import Redis from 'ioredis';
import { cfg } from './config.mjs';

export async function redis(command, key) {
  const client = new Redis({ ...cfg.redis, lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 8000 });
  await client.connect();
  try {
    if (command === 'exists') return (await client.exists(key)) === 1;
    if (command === 'ttl') return await client.ttl(key);
    if (command === 'get') return await client.get(key);
    if (command === 'scan') {
      const keys = [];
      let cursor = '0';
      do {
        const [next, batch] = await client.scan(cursor, 'MATCH', key, 'COUNT', 200);
        cursor = next;
        keys.push(...batch);
      } while (cursor !== '0' && keys.length < 200);
      return keys;
    }
    throw new Error('commande: exists | ttl | get | scan');
  } finally {
    client.disconnect();
  }
}
