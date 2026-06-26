import type { BroadcastPayload } from '../../lib/types';

/** A letter/handout the GM can push to the broadcast reveal. */
export interface Handout {
  id: string;
  title: string;
  body: string;
  /** asset id of an uploaded image (an image handout), if any */
  assetId?: string;
}

/**
 * Build the broadcast payload for a handout: an image payload when a resolved
 * image url is supplied, otherwise a text payload. Pure — unit-tested, no DOM.
 */
export function handoutPayload(handout: Handout, imageUrl?: string): BroadcastPayload {
  if (handout.assetId && imageUrl) {
    return { kind: 'image', src: imageUrl, caption: handout.title || undefined };
  }
  return { kind: 'text', title: handout.title || undefined, body: handout.body };
}
