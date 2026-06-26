export type QuestStatus = 'open' | 'resolved';

export interface Quest {
  id: string;
  title: string;
  status: QuestStatus;
  clues: string[];
  notes: string;
}

export interface QuestCounts {
  open: number;
  resolved: number;
  total: number;
}

/** Tally quests by status. Pure — unit-tested, no DOM. */
export function counts(quests: Quest[]): QuestCounts {
  const open = quests.filter((q) => q.status === 'open').length;
  return { open, resolved: quests.length - open, total: quests.length };
}

/** Quests with the given status, in original order. */
export function byStatus(quests: Quest[], status: QuestStatus): Quest[] {
  return quests.filter((q) => q.status === status);
}
