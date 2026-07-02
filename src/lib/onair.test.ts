import { describe, it, expect } from 'vitest';
import { describeOnAir } from './onair';

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
