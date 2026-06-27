import type { BusMessage, BroadcastPayload, DisplayMode } from './types';

type AudioStatusInput = Omit<Extract<BusMessage, { type: 'audioStatus' }>, 'type' | 'at'>;

export const CHANNEL = 'gm-assistant';

/** Pure helper: wrap a payload into a timestamped bus message. Unit-testable without a channel. */
export function makeMessage(payload: BroadcastPayload): Extract<BusMessage, { type: 'broadcast' }> {
  return { type: 'broadcast', payload, at: Date.now() };
}

/** Pure helper: wrap a display-mode change into a timestamped bus message. */
export function makeDisplayMessage(mode: DisplayMode): Extract<BusMessage, { type: 'display' }> {
  return { type: 'display', mode, at: Date.now() };
}

/** Pure helper: wrap a mood-preset change into a timestamped bus message. */
export function makeMoodMessage(moodId: string): Extract<BusMessage, { type: 'mood' }> {
  return { type: 'mood', moodId, at: Date.now() };
}

/** Pure helper: wrap an audio playback-status report into a timestamped bus message. */
export function makeAudioStatusMessage(
  status: AudioStatusInput
): Extract<BusMessage, { type: 'audioStatus' }> {
  return { type: 'audioStatus', ...status, at: Date.now() };
}

export interface Bus {
  send(payload: BroadcastPayload): BusMessage;
  sendDisplay(mode: DisplayMode): BusMessage;
  sendMood(moodId: string): BusMessage;
  sendAudioStatus(status: AudioStatusInput): BusMessage;
  on(cb: (msg: BusMessage) => void): () => void;
  close(): void;
}

/**
 * GM <-> Broadcast control link over BroadcastChannel (same origin).
 * GM tab calls send(); broadcast tab subscribes via on().
 */
export function createBus(name: string = CHANNEL): Bus {
  const ch = new BroadcastChannel(name);
  return {
    send(payload) {
      const msg = makeMessage(payload);
      ch.postMessage(msg);
      return msg;
    },
    sendDisplay(mode) {
      const msg = makeDisplayMessage(mode);
      ch.postMessage(msg);
      return msg;
    },
    sendMood(moodId) {
      const msg = makeMoodMessage(moodId);
      ch.postMessage(msg);
      return msg;
    },
    sendAudioStatus(status) {
      const msg = makeAudioStatusMessage(status);
      ch.postMessage(msg);
      return msg;
    },
    on(cb) {
      const handler = (e: MessageEvent<BusMessage>) => cb(e.data);
      ch.addEventListener('message', handler);
      return () => ch.removeEventListener('message', handler);
    },
    close() {
      ch.close();
    },
  };
}
