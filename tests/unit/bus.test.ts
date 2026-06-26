import { describe, it, expect } from 'vitest';
import { makeMessage } from '../../src/lib/bus';

describe('bus.makeMessage', () => {
  it('wraps a payload with type + timestamp', () => {
    const before = Date.now();
    const msg = makeMessage({ kind: 'text', body: 'hello' });
    expect(msg.type).toBe('broadcast');
    expect(msg.payload).toEqual({ kind: 'text', body: 'hello' });
    expect(msg.at).toBeGreaterThanOrEqual(before);
  });

  it('passes clear payloads through', () => {
    expect(makeMessage({ kind: 'clear' }).payload).toEqual({ kind: 'clear' });
  });
});
