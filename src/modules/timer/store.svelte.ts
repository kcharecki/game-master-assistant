import { kvSet, kvGet } from '../../lib/db';

/** Format seconds as H:MM:SS (or M:SS under an hour). */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
}

/**
 * Session timer with optional scene budget and break reminder. Pure & tickable:
 * tick(sec) advances elapsed only while running. Break reminder fires when the
 * time since the last break crosses the interval; ack resets that window.
 */
export class TimerStore {
  elapsed = $state(0);
  running = $state(false);
  /** optional per-scene budget in seconds; 0 = none */
  sceneBudget = $state(0);
  /** break reminder interval in minutes; 0 = off */
  breakEvery = $state(30);
  /** elapsed at which the last break was acknowledged */
  #lastBreakAt = 0;
  breakDue = $state(false);

  start(): void {
    this.running = true;
    this.persist();
  }

  pause(): void {
    this.running = false;
    this.persist();
  }

  reset(): void {
    this.elapsed = 0;
    this.running = false;
    this.#lastBreakAt = 0;
    this.breakDue = false;
    this.persist();
  }

  /** Advance the clock by `sec` seconds if running. Returns true if a break just became due. */
  tick(sec = 1): boolean {
    if (!this.running) return false;
    this.elapsed += sec;
    const wasDue = this.breakDue;
    if (this.breakEvery > 0 && this.elapsed - this.#lastBreakAt >= this.breakEvery * 60) {
      this.breakDue = true;
    }
    this.persist();
    return this.breakDue && !wasDue;
  }

  /** Acknowledge the break; starts the next interval window. */
  ackBreak(): void {
    this.#lastBreakAt = this.elapsed;
    this.breakDue = false;
    this.persist();
  }

  /** 0..1 fraction of the scene budget consumed (0 if no budget). */
  get budgetFraction(): number {
    if (this.sceneBudget <= 0) return 0;
    return Math.min(1, this.elapsed / this.sceneBudget);
  }

  get overBudget(): boolean {
    return this.sceneBudget > 0 && this.elapsed > this.sceneBudget;
  }

  persist(): void {
    void kvSet('timer', {
      elapsed: this.elapsed,
      sceneBudget: this.sceneBudget,
      breakEvery: this.breakEvery,
      lastBreakAt: this.#lastBreakAt,
    });
  }

  async load(): Promise<void> {
    const saved = await kvGet<{
      elapsed: number;
      sceneBudget: number;
      breakEvery: number;
      lastBreakAt: number;
    }>('timer');
    if (saved) {
      this.elapsed = saved.elapsed ?? 0;
      this.sceneBudget = saved.sceneBudget ?? 0;
      this.breakEvery = saved.breakEvery ?? 30;
      this.#lastBreakAt = saved.lastBreakAt ?? 0;
    }
  }
}

export const timer = new TimerStore();
