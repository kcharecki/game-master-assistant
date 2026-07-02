import { describe, it, expect } from 'vitest';
import { describeOnAir, pushHistory, type OnAirEntry } from './onair';

const entry = (id: string, payload: OnAirEntry['payload']): OnAirEntry => ({ id, at: 0, payload });

describe('describeOnAir', () => {
  it('reports idle for undefined and clear', () => {
    expect(describeOnAir(undefined)).toEqual({ live: false });
    expect(describeOnAir({ kind: 'clear' })).toEqual({ live: false });
  });

  it('labels text by title, then body head, then fallback', () => {
    expect(describeOnAir({ kind: 'text', title: 'Letter', body: 'x' })).toEqual({
      live: true,
      label: 'Letter',
    });
    expect(describeOnAir({ kind: 'text', body: 'a'.repeat(60) }).label).toHaveLength(40);
    expect(describeOnAir({ kind: 'text', body: '' })).toEqual({ live: true, label: 'Text' });
  });

  it('labels image by caption with fallback', () => {
    expect(describeOnAir({ kind: 'image', caption: 'Map crop' }).label).toBe('Map crop');
    expect(describeOnAir({ kind: 'image' }).label).toBe('Image');
  });

  it('labels map, grid and roll', () => {
    expect(describeOnAir({ kind: 'map', reveal: [] }).label).toBe('Battle map');
    expect(describeOnAir({ kind: 'grid', cols: 2, cells: [] }).label).toBe('Stage');
    expect(
      describeOnAir({
        kind: 'roll',
        label: 'Sanity',
        expr: '1d100',
        rolls: [5],
        kept: [5],
        modifier: 0,
        total: 5,
      }).label
    ).toBe('Sanity');
  });

  it('treats transient overlays and audio as not on-air', () => {
    expect(describeOnAir({ kind: 'ping', x: 0.5, y: 0.5 })).toEqual({ live: false });
    expect(describeOnAir({ kind: 'laser', x: 0.5, y: 0.5, on: true })).toEqual({ live: false });
    expect(describeOnAir({ kind: 'audio', channel: 'sfx', action: 'play' })).toEqual({
      live: false,
    });
  });
});

describe('pushHistory', () => {
  it('prepends most-recent-first and trims to n', () => {
    let list: OnAirEntry[] = [];
    list = pushHistory(list, entry('1', { kind: 'text', body: 'a' }), 2);
    list = pushHistory(list, entry('2', { kind: 'text', body: 'b' }), 2);
    list = pushHistory(list, entry('3', { kind: 'text', body: 'c' }), 2);
    expect(list.map((e) => e.id)).toEqual(['3', '2']);
  });

  it('skips non-history-worthy payloads (clear/overlays/audio)', () => {
    const base = [entry('1', { kind: 'text', body: 'a' })];
    expect(pushHistory(base, entry('2', { kind: 'clear' }), 5)).toBe(base);
    expect(pushHistory(base, entry('3', { kind: 'ping', x: 0, y: 0 }), 5)).toBe(base);
    expect(pushHistory(base, entry('4', { kind: 'laser', x: 0, y: 0, on: true }), 5)).toBe(base);
    expect(pushHistory(base, entry('5', { kind: 'audio', channel: 'sfx', action: 'play' }), 5)).toBe(
      base,
    );
  });

  it('keeps content payloads (image/map/grid/roll)', () => {
    const r = pushHistory([], entry('1', { kind: 'image', caption: 'x' }), 5);
    expect(r).toHaveLength(1);
  });
});
