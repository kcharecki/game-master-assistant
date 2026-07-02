import { db } from './db';

/** Object stores (besides kv) that hold campaign data. */
const STORES = ['npcs', 'scenes', 'handouts', 'notes'] as const;

/** A serialized asset blob: base64 payload + mime type, JSON-safe. */
export interface AssetDump {
  id: string;
  type: string;
  data: string; // base64
}

/** The full, portable campaign file. */
export interface CampaignFile {
  version: 1;
  exportedAt: number;
  kv: Record<string, unknown>;
  stores: Record<string, unknown[]>;
  assets: AssetDump[];
}

export const CAMPAIGN_VERSION = 1;

// --- pure base64 <-> bytes (browser btoa/atob; chunked to avoid arg limits) ---

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Build a CampaignFile from raw dumped pieces. Pure — unit-tested, no DOM.
 * Keeps the (de)serialization shape independent of IndexedDB plumbing.
 */
export function buildCampaign(
  kv: Record<string, unknown>,
  stores: Record<string, unknown[]>,
  assets: AssetDump[],
  now = Date.now()
): CampaignFile {
  return { version: CAMPAIGN_VERSION, exportedAt: now, kv, stores, assets };
}

/**
 * Validate/narrow an unknown parsed JSON into a CampaignFile. Throws on a
 * structurally invalid or wrong-version file. Pure — unit-tested.
 */
export function parseCampaign(raw: unknown): CampaignFile {
  if (!raw || typeof raw !== 'object') throw new Error('Not a campaign file');
  const c = raw as Partial<CampaignFile>;
  if (c.version !== CAMPAIGN_VERSION) throw new Error(`Unsupported version: ${String(c.version)}`);
  if (typeof c.kv !== 'object' || !c.kv) throw new Error('Missing kv');
  if (typeof c.stores !== 'object' || !c.stores) throw new Error('Missing stores');
  if (!Array.isArray(c.assets)) throw new Error('Missing assets');
  return c as CampaignFile;
}

// --- IndexedDB-facing export / import ---

/** Dump everything into a portable CampaignFile (assets base64-encoded). */
export async function exportCampaign(): Promise<CampaignFile> {
  const d = await db();

  const kv: Record<string, unknown> = {};
  for (const key of await d.getAllKeys('kv')) {
    kv[String(key)] = await d.get('kv', key);
  }

  const stores: Record<string, unknown[]> = {};
  for (const s of STORES) {
    stores[s] = await d.getAll(s);
  }

  const assets: AssetDump[] = [];
  for (const a of await d.getAll('assets')) {
    const buf = new Uint8Array(await a.blob.arrayBuffer());
    assets.push({ id: a.id, type: a.type, data: bytesToBase64(buf) });
  }

  return buildCampaign(kv, stores, assets);
}

/**
 * Restore a CampaignFile into IndexedDB. Existing records with the same key
 * are overwritten (merge-by-replace); records not in the file are left alone.
 */
export async function importCampaign(file: CampaignFile): Promise<void> {
  const d = await db();

  for (const [k, v] of Object.entries(file.kv)) {
    await d.put('kv', v, k);
  }
  for (const [s, rows] of Object.entries(file.stores)) {
    if (!(STORES as readonly string[]).includes(s)) continue;
    for (const row of rows) {
      await d.put(s as (typeof STORES)[number], row as never);
    }
  }
  for (const a of file.assets) {
    const blob = new Blob([base64ToBytes(a.data).buffer as ArrayBuffer], { type: a.type });
    await d.put('assets', { id: a.id, blob, type: a.type });
  }
}

/** Serialize a campaign to a pretty JSON string for download. */
export function campaignToJson(file: CampaignFile): string {
  return JSON.stringify(file, null, 2);
}

// --- Session auto-backup snapshots -----------------------------------------

/**
 * A lightweight session-end snapshot: the campaign's kv + object-store rows
 * (WITHOUT asset blobs, which are large and already persisted separately).
 * Kept as a small ring in one kv key so we can roll back a bad session.
 */
export interface Snapshot {
  id: string;
  at: number;
  label: string;
  kv: Record<string, unknown>;
  stores: Record<string, unknown[]>;
}

/** kv key holding the snapshot ring. */
export const SNAPSHOTS_KEY = 'sessionSnapshots';
/** how many snapshots to retain. */
export const MAX_SNAPSHOTS = 5;

/**
 * Build a Snapshot record from dumped kv + stores. Pure — unit-tested.
 * `label` defaults to a locale-independent ISO-ish timestamp.
 */
export function buildSnapshot(
  kv: Record<string, unknown>,
  stores: Record<string, unknown[]>,
  now = Date.now(),
  id = 'snap-' + now
): Snapshot {
  return { id, at: now, label: new Date(now).toISOString(), kv, stores };
}

/**
 * Pure ring push: prepend `snap` (newest-first) and keep at most `n`. Used to
 * cap how many auto-backups we retain. Pure — unit-tested.
 */
export function pushSnapshot(ring: Snapshot[], snap: Snapshot, n = MAX_SNAPSHOTS): Snapshot[] {
  return [snap, ...ring].slice(0, Math.max(0, n));
}

/**
 * Merge a snapshot's stores/kv over a live pair of dumps (snapshot wins on key
 * collisions; live-only rows are preserved). Pure — the core of a rollback.
 * Rows are keyed by their `id`; kv by its key.
 */
export function mergeSnapshot(
  live: { kv: Record<string, unknown>; stores: Record<string, unknown[]> },
  snap: Snapshot
): { kv: Record<string, unknown>; stores: Record<string, unknown[]> } {
  const kv = { ...live.kv, ...snap.kv };
  const stores: Record<string, unknown[]> = {};
  const names = new Set([...Object.keys(live.stores), ...Object.keys(snap.stores)]);
  for (const name of names) {
    const byId = new Map<unknown, unknown>();
    for (const row of live.stores[name] ?? []) byId.set((row as { id: unknown }).id, row);
    for (const row of snap.stores[name] ?? []) byId.set((row as { id: unknown }).id, row);
    stores[name] = [...byId.values()];
  }
  return { kv, stores };
}

/** Dump kv + object stores (no asset blobs) for a snapshot. */
async function dumpForSnapshot(): Promise<{
  kv: Record<string, unknown>;
  stores: Record<string, unknown[]>;
}> {
  const d = await db();
  const kv: Record<string, unknown> = {};
  for (const key of await d.getAllKeys('kv')) {
    // don't snapshot the snapshot ring itself
    if (String(key) === SNAPSHOTS_KEY) continue;
    kv[String(key)] = await d.get('kv', key);
  }
  const stores: Record<string, unknown[]> = {};
  for (const s of STORES) stores[s] = await d.getAll(s);
  return { kv, stores };
}

/**
 * Capture a session-end snapshot and push it onto the retained ring in kv.
 * Returns the new snapshot. Safe to call on `beforeunload` / "end session".
 */
export async function makeSnapshot(label?: string): Promise<Snapshot> {
  const d = await db();
  const dump = await dumpForSnapshot();
  const snap = buildSnapshot(dump.kv, dump.stores);
  if (label) snap.label = label;
  const ring = ((await d.get('kv', SNAPSHOTS_KEY)) as Snapshot[] | undefined) ?? [];
  await d.put('kv', pushSnapshot(ring, snap), SNAPSHOTS_KEY);
  return snap;
}

/** List retained snapshots, newest first. */
export async function listSnapshots(): Promise<Snapshot[]> {
  const d = await db();
  return ((await d.get('kv', SNAPSHOTS_KEY)) as Snapshot[] | undefined) ?? [];
}

/**
 * Restore a snapshot by id back into IndexedDB (merge over current data). Rows
 * present in the snapshot overwrite; live-only rows are left alone. Returns true
 * if the snapshot existed. Caller reloads to re-hydrate stores.
 */
export async function restoreSnapshot(id: string): Promise<boolean> {
  const d = await db();
  const ring = ((await d.get('kv', SNAPSHOTS_KEY)) as Snapshot[] | undefined) ?? [];
  const snap = ring.find((s) => s.id === id);
  if (!snap) return false;
  for (const [k, v] of Object.entries(snap.kv)) await d.put('kv', v, k);
  for (const [s, rows] of Object.entries(snap.stores)) {
    if (!(STORES as readonly string[]).includes(s)) continue;
    for (const row of rows) await d.put(s as (typeof STORES)[number], row as never);
  }
  return true;
}

export interface QuotaInfo {
  usage: number;
  quota: number;
  /** fraction 0..1 of quota used (0 when quota unknown) */
  ratio: number;
  /** true when usage is within ~10% of quota */
  nearLimit: boolean;
}

/**
 * Compute quota pressure from raw usage/quota numbers. Pure — unit-tested.
 */
export function quotaInfo(usage: number, quota: number): QuotaInfo {
  const ratio = quota > 0 ? usage / quota : 0;
  return { usage, quota, ratio, nearLimit: ratio >= 0.9 };
}

/**
 * Query storage quota via the Storage API, gracefully degrading when the API
 * is unavailable (returns zeros rather than throwing).
 */
export async function estimateQuota(): Promise<QuotaInfo> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return quotaInfo(0, 0);
  }
  try {
    const est = await navigator.storage.estimate();
    return quotaInfo(est.usage ?? 0, est.quota ?? 0);
  } catch {
    return quotaInfo(0, 0);
  }
}
