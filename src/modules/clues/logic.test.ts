import { describe, it, expect } from 'vitest';
import {
  emptyBoard,
  addPin,
  movePin,
  setPinText,
  removePin,
  connect,
  disconnect,
  toggleConnection,
  isConnected,
  serialize,
  deserialize,
} from './logic';

describe('clue board logic', () => {
  it('adds and moves pins immutably', () => {
    const b0 = emptyBoard();
    const b1 = addPin(b0, 'bloody glove', 10, 10);
    expect(b0.pins).toHaveLength(0);
    expect(b1.pins).toHaveLength(1);
    const id = b1.pins[0].id;
    const b2 = movePin(b1, id, 99, 50);
    expect(b2.pins[0]).toMatchObject({ x: 99, y: 50 });
  });

  it('edits pin text', () => {
    const b = addPin(emptyBoard(), 'old');
    const id = b.pins[0].id;
    expect(setPinText(b, id, 'new').pins[0].text).toBe('new');
  });

  it('connects two distinct pins, idempotently and order-independent', () => {
    let b = addPin(addPin(emptyBoard(), 'a'), 'b');
    const [a, c] = b.pins.map((p) => p.id);
    b = connect(b, a, c);
    b = connect(b, c, a); // duplicate, reversed
    expect(b.connections).toHaveLength(1);
    expect(isConnected(b, a, c)).toBe(true);
  });

  it('refuses self-connection', () => {
    const b = addPin(emptyBoard(), 'lonely');
    const id = b.pins[0].id;
    expect(connect(b, id, id).connections).toHaveLength(0);
  });

  it('disconnects and toggles', () => {
    let b = addPin(addPin(emptyBoard(), 'a'), 'b');
    const [a, c] = b.pins.map((p) => p.id);
    b = connect(b, a, c);
    b = disconnect(b, c, a);
    expect(b.connections).toHaveLength(0);
    b = toggleConnection(b, a, c);
    expect(isConnected(b, a, c)).toBe(true);
    b = toggleConnection(b, a, c);
    expect(isConnected(b, a, c)).toBe(false);
  });

  it('removing a pin drops its strings', () => {
    let b = addPin(addPin(emptyBoard(), 'a'), 'b');
    const [a, c] = b.pins.map((p) => p.id);
    b = connect(b, a, c);
    b = removePin(b, a);
    expect(b.pins).toHaveLength(1);
    expect(b.connections).toHaveLength(0);
  });

  it('round-trips through serialize/deserialize', () => {
    let b = addPin(addPin(emptyBoard(), 'a'), 'b');
    const [a, c] = b.pins.map((p) => p.id);
    b = connect(b, a, c);
    const round = deserialize(serialize(b));
    expect(round).toEqual(b);
  });

  it('deserialize tolerates garbage', () => {
    expect(deserialize('not json')).toEqual(emptyBoard());
  });
});
