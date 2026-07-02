import { describe, it, expect } from 'vitest';
import { handoutPayload, type Handout } from './logic';

const text: Handout = { id: 'h1', title: 'The Letter', body: 'Come at midnight.' };
const image: Handout = { id: 'h2', title: 'Map Fragment', body: '', assetId: 'a1' };

describe('handoutPayload', () => {
  it('builds a text payload for a body-only handout', () => {
    expect(handoutPayload(text)).toEqual({
      kind: 'text',
      title: 'The Letter',
      body: 'Come at midnight.',
    });
  });

  it('builds an image payload when an asset + url are present', () => {
    expect(handoutPayload(image, 'blob:xyz')).toEqual({
      kind: 'image',
      src: 'blob:xyz',
      caption: 'Map Fragment',
    });
  });

  it('falls back to text when an image handout has no resolved url', () => {
    expect(handoutPayload(image).kind).toBe('text');
  });

  it('omits an empty title', () => {
    expect(handoutPayload({ id: 'x', title: '', body: 'hi' })).toEqual({ kind: 'text', body: 'hi' });
  });

  it('carries a text theme onto the payload', () => {
    expect(handoutPayload({ id: 'x', title: 'T', body: 'hi', theme: 'parchment' })).toEqual({
      kind: 'text',
      title: 'T',
      body: 'hi',
      theme: 'parchment',
    });
  });

  it('does not theme an image handout (image has no theme field)', () => {
    const p = handoutPayload({ id: 'y', title: 'M', body: '', assetId: 'a1', theme: 'letter' }, 'blob:z');
    expect(p).toEqual({ kind: 'image', src: 'blob:z', caption: 'M' });
  });
});
