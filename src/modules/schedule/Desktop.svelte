<script lang="ts">
  import { onMount } from 'svelte';
  import { schedule } from './store.svelte';
  import type { ScheduledEvent } from './logic';

  onMount(() => void schedule.load());

  const HOURS = Array.from({ length: 24 }, (_, h) => h);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  // Events on the current day, bucketed by hour.
  let byHour = $derived.by(() => {
    const m = new Map<number, ScheduledEvent[]>();
    for (const e of schedule.today) {
      const list = m.get(e.time.hour) ?? [];
      list.push(e);
      m.set(e.time.hour, list);
    }
    return m;
  });

  function addAtHour(hour: number) {
    schedule.addEvent({ ...schedule.current, hour, minute: 0 }, 'New event');
  }
</script>

<div class="sched" data-no-drag>
  <header class="now">
    <span class="clock">{schedule.clock}</span>
    <span class="date">{schedule.label}</span>
  </header>

  <div class="controls">
    <div class="grp">
      <button class="btn sm" onclick={() => schedule.advanceMinutes(-1440)} aria-label="Back one day">−1d</button>
      <button class="btn sm" onclick={() => schedule.advanceMinutes(-60)} aria-label="Back one hour">−1h</button>
      <button class="btn sm" onclick={() => schedule.advanceMinutes(-10)} aria-label="Back ten minutes">−10m</button>
      <button class="btn sm" onclick={() => schedule.advanceMinutes(10)} aria-label="Forward ten minutes">+10m</button>
      <button class="btn sm" onclick={() => schedule.advanceMinutes(60)} aria-label="Forward one hour">+1h</button>
      <button class="btn sm" onclick={() => schedule.advanceMinutes(1440)} aria-label="Forward one day">+1d</button>
    </div>
    <div class="grp set">
      <input
        class="num"
        type="number"
        min="0"
        max="23"
        value={schedule.current.hour}
        onchange={(e) => schedule.setClock(Number(e.currentTarget.value), schedule.current.minute)}
        aria-label="Hour"
      />
      <span class="colon">:</span>
      <input
        class="num"
        type="number"
        min="0"
        max="59"
        value={schedule.current.minute}
        onchange={(e) => schedule.setClock(schedule.current.hour, Number(e.currentTarget.value))}
        aria-label="Minute"
      />
      <button class="btn sm" onclick={() => addAtHour(schedule.current.hour)}>＋ Event now</button>
    </div>
  </div>

  <div class="timeline">
    {#each HOURS as h (h)}
      <div class="hrow" class:current={h === schedule.current.hour}>
        <span class="hlabel">{pad(h)}:00</span>
        <div class="hevents">
          {#each byHour.get(h) ?? [] as ev (ev.id)}
            <div class="ev">
              <span class="evclock">{pad(ev.time.hour)}:{pad(ev.time.minute)}</span>
              <input
                class="evtitle"
                value={ev.title}
                oninput={(e) => schedule.updateEvent(ev.id, { title: e.currentTarget.value })}
                placeholder="Event"
              />
              <button class="evx" onclick={() => schedule.removeEvent(ev.id)} aria-label="Remove event">✕</button>
            </div>
          {/each}
          <button class="addhr" onclick={() => addAtHour(h)} aria-label={`Add event at ${pad(h)}:00`}>＋</button>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .sched {
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--txt);
    font-size: 13px;
  }
  .now {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 8px;
  }
  .clock {
    font-family: Georgia, serif;
    font-size: 30px;
    color: var(--green, #5fbf8f);
    line-height: 1;
  }
  .date {
    color: var(--muted, #9a9484);
    font-size: 12px;
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 8px;
  }
  .grp {
    display: flex;
    gap: 4px;
    align-items: center;
    flex-wrap: wrap;
  }
  .grp.set {
    gap: 3px;
  }
  .colon {
    color: var(--muted, #9a9484);
  }
  .num {
    width: 44px;
    padding: 4px 6px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
  }
  .btn.sm {
    padding: 4px 8px;
    font-size: 12px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(9, 16, 13, 0.8);
    color: var(--txt);
    cursor: pointer;
  }
  .btn.sm:hover {
    background: rgba(47, 138, 102, 0.18);
  }
  .timeline {
    flex: 1;
    overflow-y: auto;
    border-top: 1px solid var(--line2);
  }
  .hrow {
    display: flex;
    gap: 8px;
    padding: 3px 2px;
    border-bottom: 1px solid rgba(95, 150, 120, 0.08);
  }
  .hrow.current {
    position: relative;
    background: rgba(47, 138, 102, 0.14);
  }
  /* Pulsing "beam" on the left edge of the current hour. */
  .hrow.current::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--green, #5fbf8f);
    box-shadow: 0 0 6px var(--green, #5fbf8f);
    animation: beam 1.8s ease-in-out infinite;
  }
  @keyframes beam {
    0%,
    100% {
      opacity: 0.45;
      box-shadow: 0 0 4px var(--green, #5fbf8f);
    }
    50% {
      opacity: 1;
      box-shadow: 0 0 10px var(--green, #5fbf8f), 0 0 16px rgba(57, 217, 138, 0.5);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .hrow.current::before {
      animation: none;
      opacity: 0.9;
    }
  }
  .hlabel {
    flex: 0 0 44px;
    font-variant-numeric: tabular-nums;
    color: var(--muted, #9a9484);
    padding-top: 4px;
    font-size: 12px;
  }
  .hevents {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .ev {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .evclock {
    flex: 0 0 auto;
    color: var(--gold, #c7a44e);
    font-variant-numeric: tabular-nums;
    font-size: 11px;
  }
  .evtitle {
    flex: 1;
    min-width: 0;
    padding: 4px 6px;
    border-radius: 6px;
    border: 1px solid var(--line2);
    background: rgba(0, 0, 0, 0.25);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
  }
  .evx {
    flex: 0 0 auto;
    width: 18px;
    height: 18px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--muted, #9a9484);
    cursor: pointer;
  }
  .evx:hover {
    background: #8a3b34;
    color: #fff;
  }
  .addhr {
    align-self: flex-start;
    width: 20px;
    height: 18px;
    padding: 0;
    border: 1px solid var(--line2);
    border-radius: 4px;
    background: transparent;
    color: var(--muted, #9a9484);
    cursor: pointer;
    font-size: 11px;
  }
  .addhr:hover {
    background: rgba(47, 138, 102, 0.18);
    color: var(--txt);
  }
</style>
