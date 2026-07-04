import { describe, it, expect } from 'vitest';
import {
  crossfadeGains,
  nextIndex,
  advanceIndex,
  effectiveVolume,
  perceptual,
  shuffle,
  reorder,
  formatTime,
  parseYouTubeId,
  repeatMode,
  repeatFlags,
} from './logic';

describe('perceptual', () => {
  it('squares the input for a usable low end', () => {
    expect(perceptual(0.1)).toBeCloseTo(0.01);
    expect(perceptual(0.5)).toBeCloseTo(0.25);
  });
  it('clamps out-of-range and non-finite to [0,1]', () => {
    expect(perceptual(1)).toBe(1);
    expect(perceptual(2)).toBe(1);
    expect(perceptual(-1)).toBe(0);
    expect(perceptual(NaN)).toBe(0);
  });
});

describe('shuffle', () => {
  it('preserves the multiset and does not mutate the input', () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffle(src, () => 0);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });
  it('is deterministic given a fixed rng', () => {
    const seq = [0.9, 0.1, 0.8, 0.2];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    expect(shuffle([1, 2, 3, 4], rng)).toEqual(shuffle([1, 2, 3, 4], (() => { let j = 0; return () => seq[j++ % seq.length]; })()));
  });
});

describe('crossfadeGains', () => {
  it('starts fully on the outgoing track', () => {
    expect(crossfadeGains(0, 1000)).toEqual({ out: 1, in: 0 });
  });

  it('is balanced at the midpoint', () => {
    expect(crossfadeGains(500, 1000)).toEqual({ out: 0.5, in: 0.5 });
  });

  it('ends fully on the incoming track', () => {
    expect(crossfadeGains(1000, 1000)).toEqual({ out: 0, in: 1 });
  });

  it('clamps past the end and handles zero duration', () => {
    expect(crossfadeGains(5000, 1000)).toEqual({ out: 0, in: 1 });
    expect(crossfadeGains(10, 0)).toEqual({ out: 0, in: 1 });
  });
});

describe('nextIndex', () => {
  it('advances and wraps around', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
  });

  it('is safe on an empty list', () => {
    expect(nextIndex(0, 0)).toBe(0);
  });
});

describe('advanceIndex', () => {
  it('advances within bounds', () => {
    expect(advanceIndex(0, 3)).toBe(1);
    expect(advanceIndex(1, 3, {}, -1)).toBe(0);
  });

  it('stops at the ends without looping', () => {
    expect(advanceIndex(2, 3)).toBe(-1);
    expect(advanceIndex(0, 3, {}, -1)).toBe(-1);
  });

  it('wraps when loopList is set', () => {
    expect(advanceIndex(2, 3, { loopList: true })).toBe(0);
    expect(advanceIndex(0, 3, { loopList: true }, -1)).toBe(2);
  });

  it('repeats the current track when loopTrack is set', () => {
    expect(advanceIndex(1, 3, { loopTrack: true })).toBe(1);
    expect(advanceIndex(1, 3, { loopTrack: true }, -1)).toBe(1);
  });

  it('is safe on an empty queue', () => {
    expect(advanceIndex(0, 0)).toBe(-1);
  });
});

describe('repeat mode mapping', () => {
  it('derives the mode from the two booleans (loopTrack wins)', () => {
    expect(repeatMode(false, false)).toBe('off');
    expect(repeatMode(true, false)).toBe('scene');
    expect(repeatMode(false, true)).toBe('track');
    expect(repeatMode(true, true)).toBe('track');
  });
  it('maps a mode back to booleans and round-trips', () => {
    expect(repeatFlags('off')).toEqual({ loopList: false, loopTrack: false });
    expect(repeatFlags('scene')).toEqual({ loopList: true, loopTrack: false });
    expect(repeatFlags('track').loopTrack).toBe(true);
    for (const m of ['off', 'scene', 'track'] as const) {
      const f = repeatFlags(m);
      expect(repeatMode(f.loopList, f.loopTrack)).toBe(m);
    }
  });
});

describe('effectiveVolume', () => {
  it('multiplies factors and clamps to 0..1', () => {
    expect(effectiveVolume(0.5, 0.5)).toBe(0.25);
    expect(effectiveVolume(1, 1, 1)).toBe(1);
    expect(effectiveVolume(2, 1)).toBe(1);
    expect(effectiveVolume(-1, 0.5)).toBe(0);
  });

  it('ignores non-finite factors', () => {
    expect(effectiveVolume(0.8, NaN)).toBeCloseTo(0.8);
  });
});

describe('reorder', () => {
  it('moves an item forward and back', () => {
    expect(reorder(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(reorder(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('clamps out-of-range targets and ignores bad sources', () => {
    expect(reorder(['a', 'b', 'c'], 0, 9)).toEqual(['b', 'c', 'a']);
    expect(reorder(['a', 'b', 'c'], 5, 0)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input', () => {
    const src = ['a', 'b', 'c'];
    reorder(src, 0, 2);
    expect(src).toEqual(['a', 'b', 'c']);
  });
});

describe('formatTime', () => {
  it('formats minutes and zero-padded seconds', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(600)).toBe('10:00');
  });

  it('floors fractional seconds', () => {
    expect(formatTime(9.9)).toBe('0:09');
  });

  it('clamps NaN and negatives to 0:00', () => {
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(-30)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
  });
});

describe('parseYouTubeId', () => {
  it('parses watch?v= URLs (with extra params)', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s')).toBe('dQw4w9WgXcQ');
  });

  it('parses youtu.be short links', () => {
    expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=10')).toBe('dQw4w9WgXcQ');
  });

  it('parses /embed/ URLs', () => {
    expect(parseYouTubeId('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ'
    );
  });

  it('accepts a bare 11-char id', () => {
    expect(parseYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('  dQw4w9WgXcQ  ')).toBe('dQw4w9WgXcQ');
  });

  it('rejects junk and wrong-length ids', () => {
    expect(parseYouTubeId('')).toBeNull();
    expect(parseYouTubeId('not a url')).toBeNull();
    expect(parseYouTubeId('https://example.com/video')).toBeNull();
    expect(parseYouTubeId('dQw4w9WgX')).toBeNull(); // too short
    expect(parseYouTubeId('https://vimeo.com/123456')).toBeNull();
  });
});
