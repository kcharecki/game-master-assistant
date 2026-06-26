import { kvSet, kvGet } from '../../lib/db';
import {
  type Board,
  type Pin,
  type Connection,
  addPin,
  movePin,
  setPinText,
  removePin,
  toggleConnection,
  serialize,
  deserialize,
} from './logic';

const SEED: Board = {
  pins: [
    { id: 'c1', x: 24, y: 30, text: 'Torn ledger page' },
    { id: 'c2', x: 200, y: 60, text: 'Cult sigil' },
    { id: 'c3', x: 120, y: 170, text: 'Missing fisherman' },
  ],
  connections: [{ from: 'c1', to: 'c2' }],
};

/** Red-string corkboard: draggable clue pins + the strings between them. */
class CluesStore {
  board = $state<Board>(structuredClone(SEED));

  get pins(): Pin[] {
    return this.board.pins;
  }
  get connections(): Connection[] {
    return this.board.connections;
  }

  add(text = 'New clue', x = 20, y = 20): void {
    this.board = addPin(this.board, text, x, y);
    this.persist();
  }

  move(id: string, x: number, y: number): void {
    this.board = movePin(this.board, id, x, y);
    this.persist();
  }

  setText(id: string, text: string): void {
    this.board = setPinText(this.board, id, text);
    this.persist();
  }

  remove(id: string): void {
    this.board = removePin(this.board, id);
    this.persist();
  }

  toggleConnect(from: string, to: string): void {
    this.board = toggleConnection(this.board, from, to);
    this.persist();
  }

  persist(): void {
    void kvSet('clues', serialize($state.snapshot(this.board)));
  }

  async load(): Promise<void> {
    const saved = await kvGet<string>('clues');
    if (saved) this.board = deserialize(saved);
  }
}

export const clues = new CluesStore();
