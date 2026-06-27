import { describe, it, expect } from 'vitest';
import { feedbackToMarkdown, type FeedbackItem } from './feedback';

const item = (over: Partial<FeedbackItem>): FeedbackItem => ({
  id: crypto.randomUUID(),
  module: 'npcs',
  title: 'NPC Roster',
  text: 'fix something',
  at: 1,
  ...over,
});

describe('feedbackToMarkdown', () => {
  it('returns a placeholder when empty', () => {
    expect(feedbackToMarkdown([])).toContain('No feedback yet');
  });

  it('groups items by component heading, oldest first', () => {
    const md = feedbackToMarkdown([
      item({ module: 'npcs', title: 'NPC Roster', text: 'search is slow', at: 2 }),
      item({ module: 'npcs', title: 'NPC Roster', text: 'add tags', at: 1 }),
      item({ module: 'map', title: 'Battle Map', text: 'grid too small', at: 3 }),
    ]);
    expect(md).toContain('## NPC Roster (npcs)');
    expect(md).toContain('## Battle Map (map)');
    // oldest (at:1) before newer (at:2) within the group
    expect(md.indexOf('add tags')).toBeLessThan(md.indexOf('search is slow'));
  });
});
