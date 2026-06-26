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

/** Store a binary asset (image/audio) and return its id. */
export async function assetPut(blob: Blob, type: string): Promise<string> {
  const id = crypto.randomUUID();
  await (await db()).put('assets', { id, blob, type });
  return id;
}

/** Fetch an asset's blob; returns undefined if missing. */
export async function assetGet(id: string): Promise<Blob | undefined> {
  return (await (await db()).get('assets', id))?.blob;
}

/**
 * Fetch an asset and wrap it in an object URL for direct rendering.
 * Caller is responsible for URL.revokeObjectURL when done.
 */
export async function assetUrl(id: string): Promise<string | undefined> {
  const blob = await assetGet(id);
  return blob ? URL.createObjectURL(blob) : undefined;
}
