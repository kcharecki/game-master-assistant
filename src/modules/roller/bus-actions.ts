import { createBus } from '../../lib/bus';
import type { BroadcastPayload } from '../../lib/types';
import type { RollCard } from './logic';

/**
 * Air a public roll as a big animated result card on the broadcast. The caller
 * must build the card from a NON-hidden roll (rollCardModel) — hidden GM rolls
 * are never passed here and never cross the bus.
 */
export function sendRollCard(card: RollCard): void {
  const payload: BroadcastPayload = { kind: 'roll', ...card };
  const bus = createBus();
  bus.send(payload);
  bus.close();
}
