import { describe, it, expect } from 'vitest';
import { crossfadeGains, nextIndex, formatTime, parseYouTubeId } from './logic';

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
