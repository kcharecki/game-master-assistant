<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { calendar } from './store.svelte';
  import { CALENDARS, type MoonPhase, type CalendarId, type ScheduledEvent } from './logic';
  import { system } from '../../lib/stores/system.svelte';
  import { t } from '../../lib/i18n';
  import Icon from '../../lib/components/Icon.svelte';

  onMount(() => {
    void (async () => {
      await system.load();
      await calendar.load();
    })();
  });

  // While the calendar is untouched, follow the active game system's default.
  // Depend ONLY on system.current; untrack the writes/persist so they don't
  // feed back into this effect (which would loop and freeze the widget).
  $effect(() => {
    const sys = system.current;
    untrack(() => calendar.useSystemDefault(sys));
  });

  const calIds = Object.keys(CALENDARS) as CalendarId[];
  const HOURS = Array.from({ length: 24 }, (_, h) => h);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  const GLYPH: Record<MoonPhase, string> = {
    'New Moon': '●',
    'Waxing Crescent': '◐',
    'First Quarter': '◑',
    'Waxing Gibbous': '◑',
    'Full Moon': '○',
    'Waning Gibbous': '◐',
    'Last Quarter': '◐',
    'Waning Crescent': '◐',
  };
  const MOON_KEY: Record<MoonPhase, string> = {
    'New Moon': 'calendar.moon.newMoon',
    'Waxing Crescent': 'calendar.moon.waxingCrescent',
    'First Quarter': 'calendar.moon.firstQuarter',
    'Waxing Gibbous': 'calendar.moon.waxingGibbous',
    'Full Moon': 'calendar.moon.fullMoon',
    'Waning Gibbous': 'calendar.moon.waningGibbous',
    'Last Quarter': 'calendar.moon.lastQuarter',
    'Waning Crescent': 'calendar.moon.waningCrescent',
  };

  // Current day's events bucketed by hour.
  let byHour = $derived.by(() => {
    const m = new Map<number, ScheduledEvent[]>();
    for (const e of calendar.today) {
      const list = m.get(e.time.hour) ?? [];
      list.push(e);
      m.set(e.time.hour, list);
    }
    return m;
  });

  function addAtHour(hour: number) {
    calendar.addEvent({ ...calendar.current, hour, minute: 0 }, t('calendar.newEvent'));
  }
</script>

<div class="cal" data-no-drag>
  <!-- date / moon / clock header -->
  <header class="now">
    <div class="datewrap">
      <div class="date">{calendar.label}</div>
      <div class="moon">
        <span class="glyph">{GLYPH[calendar.moon]}</span>{t(MOON_KEY[calendar.moon])}
      </div>
    </div>
    <span class="clock">{calendar.clock}</span>
  </header>

  <!-- calendar preset + year -->
  <div class="cfgrow">
    <label class="fld">
      <span class="flbl">{t('calendar.calendarLabel')}</span>
      <select
        class="in"
        value={calendar.calId}
        onchange={(e) => calendar.setCalendar(e.currentTarget.value as CalendarId)}
      >
        {#each calIds as id (id)}<option value={id}>{CALENDARS[id].name}</option>{/each}
      </select>
    </label>
    <label class="fld yr">
      <span class="flbl">{t('calendar.year')}</span>
      <input
        class="in yrnum"
        type="number"
        value={calendar.current.year}
        onchange={(e) => calendar.setYear(Number(e.currentTarget.value))}
      />
    </label>
  </div>

  <!-- navigation: days + time -->
  <div class="nav">
    <div class="grp">
      <button class="btn sm" onclick={() => calendar.advanceBy(-7)} title={t('calendar.week')}>−7d</button>
      <button class="btn sm" onclick={() => calendar.advanceBy(-1)}>{t('calendar.prevDay')}</button>
      <button class="btn sm" onclick={() => calendar.advanceBy(1)}>{t('calendar.nextDay')}</button>
      <button class="btn sm" onclick={() => calendar.advanceBy(7)} title={t('calendar.week')}>+7d</button>
    </div>
    <div class="grp">
      <button class="btn sm" onclick={() => calendar.advanceMinutes(-60)}>−1h</button>
      <button class="btn sm" onclick={() => calendar.advanceMinutes(-10)}>−10m</button>
      <input
        class="in num"
        type="number"
        min="0"
        max="23"
        value={calendar.current.hour}
        onchange={(e) => calendar.setClock(Number(e.currentTarget.value), calendar.current.minute)}
        aria-label={t('calendar.hour')}
      />
      <span class="colon">:</span>
      <input
        class="in num"
        type="number"
        min="0"
        max="59"
        value={calendar.current.minute}
        onchange={(e) => calendar.setClock(calendar.current.hour, Number(e.currentTarget.value))}
        aria-label={t('calendar.minute')}
      />
      <button class="btn sm" onclick={() => calendar.advanceMinutes(10)}>+10m</button>
      <button class="btn sm" onclick={() => calendar.advanceMinutes(60)}>+1h</button>
    </div>
  </div>

  <!-- hour timeline for the current day -->
  <div class="timeline">
    {#each HOURS as h (h)}
      <div class="hrow" class:current={h === calendar.current.hour}>
        <span class="hlabel">{pad(h)}:00</span>
        <div class="hevents">
          {#each byHour.get(h) ?? [] as ev (ev.id)}
            <div class="ev">
              <input
                class="evmin"
                type="number"
                min="0"
                max="59"
                value={ev.time.minute}
                onchange={(e) =>
                  calendar.updateEvent(ev.id, {
                    time: { ...ev.time, minute: Math.min(59, Math.max(0, Number(e.currentTarget.value) || 0)) },
                  })}
                aria-label={t('calendar.minute')}
              />
              <input
                class="evtitle"
                value={ev.title}
                oninput={(e) => calendar.updateEvent(ev.id, { title: e.currentTarget.value })}
                placeholder={t('calendar.eventPlaceholder')}
              />
              <button
                class="evx"
                onclick={() => calendar.removeEvent(ev.id)}
                aria-label={t('calendar.removeEvent')}
                title={t('calendar.removeEvent')}><Icon name="close" size={12} /></button
              >
            </div>
          {/each}
          <button class="addhr" onclick={() => addAtHour(h)} aria-label={`${t('calendar.addAtPre')}${pad(h)}:00`}>
            <Icon name="plus" size={13} />
          </button>
        </div>
      </div>
    {/each}
  </div>

  <!-- next events across days -->
  {#if calendar.upcoming.length}
    <div class="upcoming">
      <span class="uplbl">{t('calendar.upcoming')}</span>
      <ul>
        {#each calendar.upcoming as e (e.id)}
          <li>
            <span class="ud">{e.time.day}/{e.time.month} {pad(e.time.hour)}:{pad(e.time.minute)}</span>
            <span class="ut">{e.title}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .cal {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 8px;
    color: var(--txt);
    font-size: 13px;
    overflow: hidden;
  }
  .now {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--line);
  }
  .date {
    font-family: var(--num);
    font-variant-numeric: tabular-nums;
    font-size: 18px;
    color: var(--txt);
  }
  .moon {
    margin-top: 2px;
    color: var(--green);
    font-size: 12px;
  }
  .glyph {
    margin-right: 5px;
    font-size: 14px;
  }
  .clock {
    font-family: var(--num);
    font-size: 28px;
    color: var(--green);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .cfgrow {
    display: flex;
    gap: 8px;
  }
  .fld {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
  }
  .fld.yr {
    flex: 0 0 84px;
  }
  .flbl {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .in {
    box-sizing: border-box;
    padding: 5px 7px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    font: inherit;
    font-size: 12px;
  }
  .num {
    width: 48px;
    text-align: center;
  }
  .yrnum {
    width: 100%;
    text-align: center;
  }
  .nav {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .grp {
    display: flex;
    gap: 4px;
    align-items: center;
    flex-wrap: wrap;
  }
  .colon {
    color: var(--muted);
  }
  .btn.sm {
    padding: 4px 8px;
    font-size: 12px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--txt);
    cursor: pointer;
  }
  .btn.sm:hover {
    background: var(--fill-g14);
  }
  .timeline {
    flex: 1;
    overflow-y: auto;
    border-top: 1px solid var(--line2);
    min-height: 0;
  }
  .hrow {
    display: flex;
    gap: 8px;
    padding: 3px 2px;
    border-bottom: 1px solid var(--line1);
  }
  .hrow.current {
    position: relative;
    background: var(--fill-g14);
  }
  .hrow.current::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--green);
    box-shadow: 0 0 6px var(--green);
    animation: beam 1.8s ease-in-out infinite;
  }
  @keyframes beam {
    0%,
    100% {
      opacity: 0.45;
      box-shadow: 0 0 4px var(--green);
    }
    50% {
      opacity: 1;
      box-shadow: 0 0 10px var(--green), 0 0 16px var(--fill-g22);
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
    color: var(--muted);
    padding-top: 5px;
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
  .evmin {
    flex: 0 0 46px;
    width: 46px;
    box-sizing: border-box;
    padding: 4px 5px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
    color: var(--green);
    font: inherit;
    font-size: 11px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .evtitle {
    flex: 1;
    min-width: 0;
    padding: 4px 6px;
    border-radius: var(--r2);
    border: 1px solid var(--line2);
    background: var(--bg1);
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
    border-radius: var(--r1);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
  .evx:hover {
    background: var(--fill-red);
    color: var(--ink);
  }
  .addhr {
    align-self: flex-start;
    width: 20px;
    height: 18px;
    padding: 0;
    border: 1px solid var(--line2);
    border-radius: var(--r1);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 11px;
  }
  .addhr:hover {
    background: var(--fill-g14);
    color: var(--txt);
  }
  .upcoming {
    flex: 0 0 auto;
    border-top: 1px solid var(--line);
    padding-top: 6px;
  }
  .uplbl {
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .upcoming ul {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-height: 84px;
    overflow-y: auto;
  }
  .upcoming li {
    display: flex;
    gap: 8px;
    font-size: 12px;
  }
  .ud {
    flex: 0 0 auto;
    color: var(--green);
    font-variant-numeric: tabular-nums;
  }
  .ut {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
