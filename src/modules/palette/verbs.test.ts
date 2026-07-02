import { describe, it, expect } from 'vitest';
import { parseVerb, matchTarget, type NamedTarget } from './verbs';

describe('parseVerb', () => {
  it('returns null for empty / non-verb lines', () => {
    expect(parseVerb('')).toBeNull();
    expect(parseVerb('   ')).toBeNull();
    expect(parseVerb('Captain Thorne')).toBeNull();
    expect(parseVerb('goblin')).toBeNull();
  });

  it('parses "air scene <n>" as a 0-based index', () => {
    expect(parseVerb('air scene 2')).toEqual({ kind: 'airScene', index: 1 });
    expect(parseVerb('air 3')).toEqual({ kind: 'airScene', index: 2 });
    expect(parseVerb('AIR SCENE 1')).toEqual({ kind: 'airScene', index: 0 });
  });

  it('parses "air <name>" as a named target', () => {
    expect(parseVerb('air The Docks')).toEqual({ kind: 'airScene', target: 'The Docks' });
    expect(parseVerb('air scene Boss Room')).toEqual({ kind: 'airScene', target: 'Boss Room' });
  });

  it('rejects "air" with no argument', () => {
    expect(parseVerb('air')).toBeNull();
    expect(parseVerb('air scene')).toBeNull();
  });

  it('parses break start', () => {
    expect(parseVerb('start break')).toEqual({ kind: 'startBreak' });
    expect(parseVerb('take a break')).toEqual({ kind: 'startBreak' });
    expect(parseVerb('START BREAK')).toEqual({ kind: 'startBreak' });
  });

  it('parses mood with or without colon', () => {
    expect(parseVerb('mood: dread')).toEqual({ kind: 'mood', target: 'dread' });
    expect(parseVerb('mood dread')).toEqual({ kind: 'mood', target: 'dread' });
    expect(parseVerb('MOOD:  Blood ')).toEqual({ kind: 'mood', target: 'Blood' });
  });

  it('parses play + stop audio', () => {
    expect(parseVerb('play tavern')).toEqual({ kind: 'playAudio', target: 'tavern' });
    expect(parseVerb('play Boss Fight')).toEqual({ kind: 'playAudio', target: 'Boss Fight' });
    expect(parseVerb('stop audio')).toEqual({ kind: 'stopAudio' });
    expect(parseVerb('stop ambient')).toEqual({ kind: 'stopAudio' });
    expect(parseVerb('stop music')).toEqual({ kind: 'stopAudio' });
  });

  it('parses sfx by name', () => {
    expect(parseVerb('sfx thunder')).toEqual({ kind: 'sfx', target: 'thunder' });
    expect(parseVerb('sfx Door Creak')).toEqual({ kind: 'sfx', target: 'Door Creak' });
  });

  it('parses note, preserving text casing', () => {
    expect(parseVerb('note: Goblin took the Idol')).toEqual({
      kind: 'note',
      text: 'Goblin took the Idol',
    });
    expect(parseVerb('NOTE:   trimmed  ')).toEqual({ kind: 'note', text: 'trimmed' });
  });

  it('does not treat play/sfx with no argument as a verb', () => {
    expect(parseVerb('play')).toBeNull();
    expect(parseVerb('sfx')).toBeNull();
  });
});

describe('matchTarget', () => {
  const targets: NamedTarget[] = [
    { id: 'a', name: 'Tavern' },
    { id: 'b', name: 'Tavern Brawl' },
    { id: 'c', name: 'Dungeon' },
    { id: 'd', name: 'Boss Fight' },
  ];

  it('returns null for empty query or no match', () => {
    expect(matchTarget(targets, '')).toBeNull();
    expect(matchTarget(targets, 'zzz')).toBeNull();
  });

  it('prefers exact over prefix over substring', () => {
    expect(matchTarget(targets, 'tavern')?.id).toBe('a'); // exact beats "Tavern Brawl" prefix
    expect(matchTarget(targets, 'dun')?.id).toBe('c'); // prefix
    expect(matchTarget(targets, 'fight')?.id).toBe('d'); // word-start
  });

  it('is case-insensitive', () => {
    expect(matchTarget(targets, 'BOSS FIGHT')?.id).toBe('d');
  });

  it('breaks prefix ties toward the shorter name', () => {
    expect(matchTarget(targets, 'tav')?.id).toBe('a'); // both prefix; "Tavern" shorter
  });
});
