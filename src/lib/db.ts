import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface GmDB extends DBSchema {
  kv: { key: string; value: unknown };
  npcs: { key: string; value: { id: string; name: string; [k: string]: unknown } };
  scenes: { key: string; value: { id: string; title: string; [k: string]: unknown } };
  handouts: { key: string; value: { id: string; title: string; [k: string]: unknown } };
  notes: { key: string; value: { id: string; body: string; at: number } };
  assets: { key: string; value: { id: string; blob: Blob; type: string } };
}

let _db: Promise<IDBPDatabase<GmDB>> | null = null;

export function db(): Promise<IDBPDatabase<GmDB>> {
  if (!_db) {
    _db = openDB<GmDB>('gm-assistant', 1, {
      upgrade(d) {
        d.createObjectStore('kv');
        for (const s of ['npcs', 'scenes', 'handouts', 'notes', 'assets'] as const) {
          d.createObjectStore(s, { keyPath: 'id' });
        }
      },
    });
  }
  return _db;
}

/** Generic key/value get — used for window layout, broadcast state, prefs. */
export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get('kv', key)) as T | undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await (await db()).put('kv', value, key);
}
