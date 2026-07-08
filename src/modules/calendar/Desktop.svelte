<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { calendar } from './store.svelte';
  import {
    CALENDARS,
    moonFraction,
    moonPhaseName,
    upcomingTimes,
    toDayIndex,
    type CalendarId,
    type MoonPhase,
    type ScheduledEvent,
  } from './logic';
  import { system } from '../../lib/stores/system.svelte';
  import { t } from '../../lib/i18n';

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
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

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

  const NUDGES: { delta: number; label: string }[] = [
    { delta: -60, label: '−1h' },
    { delta: -10, label: '−10m' },
    { delta: 10, label: '+10m' },
    { delta: 60, label: '+1h' },
  ];

  const ZOOMS: { label: string; ppm: number }[] = [
    { label: '1h', ppm: 0.75 },
    { label: '30m', ppm: 1.5 },
    { label: '15m', ppm: 3 },
    { label: '5m', ppm: 8 },
  ];
  const PADT = 8;

  interface GridDay {
    day: number;
    blank: boolean;
    moon: string;
    selected: boolean;
  }

  /** Pure geometry: an SVG path for a crescent/gibbous moon at fraction `frac` (0..1). */
  function moonPath(frac: number, cx: number, cy: number, r: number): string {
    const k = Math.cos(frac * Math.PI * 2);
    const rx = Math.abs(k) * r;
    if (frac < 0.5) {
      return `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} A ${rx} ${r} 0 0 ${k > 0 ? 0 : 1} ${cx} ${cy - r} Z`;
    }
    return `M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} A ${rx} ${r} 0 0 ${k > 0 ? 1 : 0} ${cx} ${cy - r} Z`;
  }

  // --- local UI state --------------------------------------------------------
  let gridOpen = $state(false);
  let gridYear = $state(calendar.current.year);
  let gridMonth = $state(calendar.current.month);
  let zoom = $state(1);
  let editingId = $state<string | null>(null);
  let draftTitle = $state('');
  let draftTime = $state('00:00');
  let tlEl: HTMLDivElement | undefined;

  // --- header ------------------------------------------------------------
  let monthName = $derived(calendar.config.months[calendar.current.month - 1]?.name ?? '');
  let dateLine = $derived(
    calendar.calId === 'faerun'
      ? `${calendar.current.day} ${monthName} · ${calendar.current.year} DR`
      : `${calendar.current.day} ${monthName} ${calendar.current.year}`,
  );
  let era = $derived(calendar.calId === 'faerun' ? 'DR' : 'AD');
  let headMoonFrac = $derived(moonFraction(calendar.current, calendar.calId));
  let headMoonName = $derived(moonPhaseName(headMoonFrac));

  function toggleGrid() {
    if (!gridOpen) {
      gridYear = calendar.current.year;
      gridMonth = calendar.current.month;
    }
    gridOpen = !gridOpen;
  }
  function goNow() {
    gridOpen = false;
    editingId = null;
    void tick().then(() => scrollToMinute(calendar.current.hour * 60 + calendar.current.minute));
  }

  // --- month-grid popover --------------------------------------------------
  let gridTitle = $derived(`${calendar.config.months[gridMonth - 1]?.name ?? ''} ${gridYear}`);
  let gridCols = $derived(calendar.calId === 'faerun' ? 10 : 7);
  let gridDays = $derived.by((): GridDay[] => {
    const cfg = calendar.config;
    const monthDays = cfg.months[gridMonth - 1]?.days ?? 30;
    const lead = calendar.calId === 'gregorian' ? new Date(Date.UTC(gridYear, gridMonth - 1, 1)).getUTCDay() : 0;
    const days: GridDay[] = [];
    for (let i = 0; i < lead; i++) days.push({ day: 0, blank: true, moon: '', selected: false });
    for (let d = 1; d <= monthDays; d++) {
      const frac = moonFraction({ day: d, month: gridMonth, year: gridYear }, calendar.calId);
      const selected =
        gridYear === calendar.current.year && gridMonth === calendar.current.month && d === calendar.current.day;
      days.push({ day: d, blank: false, moon: moonPath(frac, 10, 10, 7), selected });
    }
    return days;
  });
  function gridPrev() {
    const len = calendar.config.months.length;
    let m = gridMonth - 1;
    let y = gridYear;
    if (m < 1) {
      m = len;
      y--;
    }
    gridMonth = m;
    gridYear = y;
  }
  function gridNext() {
    const len = calendar.config.months.length;
    let m = gridMonth + 1;
    let y = gridYear;
    if (m > len) {
      m = 1;
      y++;
    }
    gridMonth = m;
    gridYear = y;
  }
  function pickGridDay(d: GridDay) {
    if (d.blank) return;
    calendar.setDate({ year: gridYear, month: gridMonth, day: d.day });
    gridOpen = false;
  }
  function gridBackToToday() {
    gridYear = calendar.current.year;
    gridMonth = calendar.current.month;
  }

  // --- timeline --------------------------------------------------------------
  let ppm = $derived(ZOOMS[zoom].ppm);
  let tlHeight = $derived(1440 * ppm + PADT + 16);
  let nowTop = $derived(PADT + (calendar.current.hour * 60 + calendar.current.minute) * ppm);

  let slots = $derived.by(() => {
    const list: { top: number; hour: boolean; label: string }[] = [];
    for (let m = 0; m < 1440; m += 15) {
      const hour = m % 60 === 0;
      if (!hour && zoom === 0) continue;
      if (!hour && zoom === 1 && m % 30 !== 0) continue;
      list.push({
        top: PADT + m * ppm,
        hour,
        label: hour ? `${pad(Math.floor(m / 60))}:${pad(m % 60)}` : zoom >= 2 ? `:${pad(m % 60)}` : '',
      });
    }
    return list;
  });

  let dayEvents = $derived.by(() =>
    calendar.today.map((ev) => ({ ev, top: PADT + (ev.time.hour * 60 + ev.time.minute) * ppm })),
  );
  let editingEvent = $derived(calendar.events.find((e) => e.id === editingId));
  let editingTop = $derived(
    editingEvent ? PADT + (editingEvent.time.hour * 60 + editingEvent.time.minute) * ppm : 0,
  );

  function scrollToMinute(minute: number) {
    if (!tlEl) return;
    tlEl.scrollTop = Math.max(0, PADT + minute * ppm - tlEl.clientHeight / 2);
  }

  // Recenter on the current time whenever the selected date changes (and once
  // on mount). Zoom changes are handled separately by setZoom's own
  // center-preserving math below, so they don't fight over scrollTop.
  $effect(() => {
    void calendar.current.year;
    void calendar.current.month;
    void calendar.current.day;
    untrack(() => {
      void tick().then(() => scrollToMinute(calendar.current.hour * 60 + calendar.current.minute));
    });
  });

  function setZoom(i: number) {
    const el = tlEl;
    const old = ZOOMS[zoom].ppm;
    let center = calendar.current.hour * 60 + calendar.current.minute;
    if (el) center = (el.scrollTop + el.clientHeight / 2 - PADT) / old;
    zoom = i;
    void tick().then(() => {
      if (el) el.scrollTop = Math.max(0, PADT + center * ZOOMS[i].ppm - el.clientHeight / 2);
    });
  }

  function onTimelineClick(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let minute = Math.round((e.clientY - rect.top - PADT) / ppm / 5) * 5;
    minute = Math.max(0, Math.min(1435, minute));
    if (editingId !== null) {
      editingId = null;
      return;
    }
    const hour = Math.floor(minute / 60);
    const min = minute % 60;
    const ev = calendar.addEvent({ ...calendar.current, hour, minute: min }, '');
    editingId = ev.id;
    draftTitle = '';
    draftTime = `${pad(hour)}:${pad(min)}`;
  }

  function openEdit(ev: ScheduledEvent, e: MouseEvent) {
    e.stopPropagation();
    editingId = ev.id;
    draftTitle = ev.title;
    draftTime = `${pad(ev.time.hour)}:${pad(ev.time.minute)}`;
  }
  function saveEdit() {
    if (!editingId || !editingEvent) return;
    const [hh, mm] = draftTime.split(':').map(Number);
    calendar.updateEvent(editingId, {
      title: draftTitle,
      time: { ...editingEvent.time, hour: hh || 0, minute: mm || 0 },
    });
    editingId = null;
  }
  function deleteEdit() {
    if (!editingId) return;
    calendar.removeEvent(editingId);
    editingId = null;
  }

  // --- upcoming --------------------------------------------------------------
  let upcomingList = $derived.by(() =>
    upcomingTimes($state.snapshot(calendar.events), calendar.current, 8, calendar.config),
  );
  function daysAhead(ev: ScheduledEvent): number {
    return toDayIndex(ev.time, calendar.config) - toDayIndex(calendar.current, calendar.config);
  }
  function jumpToUpcoming(ev: ScheduledEvent) {
    calendar.setDate({ year: ev.time.year, month: ev.time.month, day: ev.time.day });
    void tick().then(() => scrollToMinute(ev.time.hour * 60 + ev.time.minute));
  }
</script>

<div class="cal" data-no-drag>
  <!-- header: date · clock · moon -->
  <header class="cal-head">
    <div class="cal-headtext">
      <div class="cal-dateline">{dateLine}</div>
      <div class="cal-clockrow">
        <span class="cal-clock">{calendar.clock}</span>
        <div class="cal-nudges">
          {#each NUDGES as n (n.label)}
            <button class="cal-nudge" onclick={() => calendar.advanceMinutes(n.delta)}>{n.label}</button>
          {/each}
        </div>
      </div>
    </div>
    <div class="cal-moonwrap">
      <svg width="30" height="30" viewBox="0 0 30 30">
        <circle cx="15" cy="15" r="12" fill="var(--gold)" fill-opacity="0.1" stroke="var(--line2)" stroke-width="1"
        ></circle>
        <path d={moonPath(headMoonFrac, 15, 15, 11)} fill="var(--gold)" opacity="0.9"></path>
      </svg>
      <div class="cal-moonname">{t(MOON_KEY[headMoonName])}</div>
    </div>
  </header>

  <!-- date nav: day / week / month steppers · grid · now -->
  <div class="cal-nav">
    <div class="cal-grain">
      <button onclick={() => calendar.advanceBy(-1)} title="−1 day">‹</button>
      <span>{t('calendar.grainDay')}</span>
      <button onclick={() => calendar.advanceBy(1)} title="+1 day">›</button>
    </div>
    <div class="cal-grain">
      <button onclick={() => calendar.advanceBy(-7)} title="−1 week">‹</button>
      <span>{t('calendar.grainWeek')}</span>
      <button onclick={() => calendar.advanceBy(7)} title="+1 week">›</button>
    </div>
    <div class="cal-grain">
      <button onclick={() => calendar.advanceMonths(-1)} title="−1 month">‹</button>
      <span>{t('calendar.grainMonth')}</span>
      <button onclick={() => calendar.advanceMonths(1)} title="+1 month">›</button>
    </div>
    <div class="cal-spacer"></div>
    <button
      class="cal-gridbtn"
      class:cal-open={gridOpen}
      onclick={toggleGrid}
      title={t('calendar.openGrid')}
      aria-label={t('calendar.openGrid')}
    >
      <svg width="12" height="12" viewBox="0 0 12 12">
        <path
          d="M0.5 0.5 H4.5 V4.5 H0.5 Z M7.5 0.5 H11.5 V4.5 H7.5 Z M0.5 7.5 H4.5 V11.5 H0.5 Z M7.5 7.5 H11.5 V11.5 H7.5 Z"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
        ></path>
      </svg>
    </button>
    <button class="cal-nowbtn" onclick={goNow} title={t('calendar.recenter')}>{t('calendar.now')}</button>

    {#if gridOpen}
      <div class="cal-gridpop">
        <div class="cal-gridhead">
          <button class="cal-gridnav" onclick={gridPrev} aria-label="prev month">‹</button>
          <div class="cal-gridtitle">{gridTitle}</div>
          <button class="cal-gridnav" onclick={gridNext} aria-label="next month">›</button>
        </div>
        <div class="cal-griddays" style="grid-template-columns: repeat({gridCols}, 1fr)">
          {#each gridDays as d, i (i)}
            {#if d.blank}
              <button class="cal-gridday cal-blank" disabled aria-hidden="true"></button>
            {:else}
              <button class="cal-gridday" class:cal-sel={d.selected} onclick={() => pickGridDay(d)}>
                <span>{d.day}</span>
                <svg width="8" height="8" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="7" fill="var(--gold)" fill-opacity="0.14"></circle>
                  <path d={d.moon} fill="var(--gold)" opacity="0.85"></path>
                </svg>
              </button>
            {/if}
          {/each}
        </div>
        <button class="cal-gridtoday" onclick={gridBackToToday}>{t('calendar.backToDate')}</button>
      </div>
    {/if}
  </div>

  <!-- timeline -->
  <div class="cal-timeline">
    <div class="cal-tlhead">
      <span class="cal-tllabel">{t('calendar.timeline')}</span>
      <span class="cal-tlhint">· {t('calendar.tapToAdd')}</span>
      <div class="cal-spacer"></div>
      <div class="cal-zoom">
        {#each ZOOMS as z, i (z.label)}
          <button class:cal-active={i === zoom} onclick={() => setZoom(i)} title="Row granularity">{z.label}</button>
        {/each}
      </div>
    </div>
    <div class="cal-tlscroll" bind:this={tlEl}>
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
      <div class="cal-tlinner" style="height:{tlHeight}px" onclick={onTimelineClick}>
        {#each slots as s (s.top)}
          <div class="cal-slotline" class:cal-hour={s.hour} style="top:{s.top}px">
            {#if s.label}
              <span class="cal-slotlabel" class:cal-hour={s.hour}>{s.label}</span>
            {/if}
          </div>
        {/each}

        <!-- now beam -->
        <div class="cal-nowband" style="top:{nowTop}px"></div>
        <div class="cal-nowline" style="top:{nowTop}px"></div>
        <div class="cal-nowbadge" style="top:{nowTop - 9}px">{t('calendar.now')} {calendar.clock}</div>

        <!-- events -->
        {#each dayEvents as { ev, top } (ev.id)}
          {#if editingId !== ev.id}
            <button class="cal-chip" style="top:{top}px" onclick={(e) => openEdit(ev, e)}>
              <span class="cal-chiptime">{pad(ev.time.hour)}:{pad(ev.time.minute)}</span>
              <span class="cal-chiptitle">{ev.title || t('calendar.eventTitle')}</span>
            </button>
          {:else}
            <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
            <div class="cal-editcard" style="top:{editingTop}px" onclick={(e) => e.stopPropagation()}>
              <!-- svelte-ignore a11y_autofocus -->
              <input
                class="cal-edittitle"
                bind:value={draftTitle}
                placeholder={t('calendar.eventTitle')}
                autofocus
              />
              <div class="cal-editrow">
                <input class="cal-edittime" type="time" bind:value={draftTime} aria-label={t('calendar.hour')} />
                <div class="cal-spacer"></div>
                <button class="cal-editdel" onclick={deleteEdit}>{t('calendar.delete')}</button>
                <button class="cal-editdone" onclick={saveEdit}>{t('calendar.done')}</button>
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  </div>

  <!-- upcoming -->
  <div class="cal-upcoming">
    <div class="cal-uplabel">{t('calendar.upcoming')}</div>
    <div class="cal-uplist">
      {#if upcomingList.length === 0}
        <div class="cal-upnone">{t('calendar.nothingAhead')}</div>
      {/if}
      {#each upcomingList as ev (ev.id)}
        {@const dd = daysAhead(ev)}
        <button class="cal-uprow" onclick={() => jumpToUpcoming(ev)} title="Jump to this event">
          <span class="cal-upwhen" class:cal-today={dd === 0}>{dd === 0 ? t('calendar.today') : `+${dd}d`}</span>
          <span class="cal-uptime">{pad(ev.time.hour)}:{pad(ev.time.minute)}</span>
          <span class="cal-uptitle">{ev.title || t('calendar.eventTitle')}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- footer: calendar preset · year -->
  <div class="cal-foot">
    <select
      class="cal-calsel"
      value={calendar.calId}
      onchange={(e) => calendar.setCalendar(e.currentTarget.value as CalendarId)}
    >
      {#each calIds as id (id)}<option value={id}>{CALENDARS[id].name}</option>{/each}
    </select>
    <input
      class="cal-yearin"
      type="number"
      value={calendar.current.year}
      onchange={(e) => calendar.setYear(Number(e.currentTarget.value))}
      title={t('calendar.year')}
    />
    <span class="cal-era">{era}</span>
  </div>
</div>

<style>
  .cal {
    --cal-glow: 0 0 8px var(--fill-g22);
    --cal-line-faint: rgba(134, 178, 153, 0.07);
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 340px;
    overflow: hidden;
    color: var(--txt);
    font-family: ui-sans-serif, system-ui, sans-serif;
  }

  /* header */
  .cal-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px 7px;
    border-bottom: 1px solid var(--line1);
    background: linear-gradient(180deg, var(--fill-g08), transparent);
  }
  .cal-headtext {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .cal-dateline {
    font-family: var(--num);
    font-weight: 600;
    font-size: 20px;
    line-height: 1.15;
    color: var(--txt);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cal-clockrow {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .cal-clock {
    font-family: var(--num);
    font-weight: 600;
    font-size: 26px;
    line-height: 1;
    color: var(--green);
    font-variant-numeric: tabular-nums;
    text-shadow: 0 0 14px var(--fill-g22);
  }
  .cal-nudges {
    display: flex;
    gap: 3px;
  }
  .cal-nudge {
    height: 22px;
    padding: 0 6px;
    font-size: 10px;
    letter-spacing: 0.02em;
    color: var(--muted);
    background: transparent;
    border: 1px solid var(--line1);
    border-radius: var(--r1);
    cursor: pointer;
    font-variant-numeric: tabular-nums;
  }
  .cal-nudge:hover {
    background: var(--fill-g14);
    color: var(--txt);
    border-color: var(--line2);
  }
  .cal-moonwrap {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding-right: 2px;
  }
  .cal-moonname {
    font-size: 8.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--faint);
    text-align: center;
    max-width: 74px;
    line-height: 1.25;
  }

  /* date nav */
  .cal-nav {
    flex: none;
    position: relative;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px 12px;
    border-bottom: 1px solid var(--line1);
  }
  .cal-grain {
    display: flex;
    align-items: stretch;
    height: 26px;
    border: 1px solid var(--line1);
    border-radius: var(--r2);
    overflow: hidden;
  }
  .cal-grain button {
    width: 22px;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    padding: 0;
  }
  .cal-grain button:hover {
    background: var(--fill-g14);
    color: var(--green);
  }
  .cal-grain span {
    display: flex;
    align-items: center;
    padding: 0 2px;
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--faint);
    user-select: none;
  }
  .cal-spacer {
    flex: 1;
  }
  .cal-gridbtn {
    width: 28px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--line1);
    border-radius: var(--r2);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    padding: 0;
  }
  .cal-gridbtn:hover,
  .cal-gridbtn.cal-open {
    background: var(--fill-g14);
  }
  .cal-nowbtn {
    height: 26px;
    padding: 0 9px;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--green);
    background: var(--fill-g14);
    border: 1px solid var(--line2);
    border-radius: var(--r2);
    cursor: pointer;
  }
  .cal-nowbtn:hover {
    background: var(--fill-g22);
  }

  /* month-grid popover */
  .cal-gridpop {
    position: absolute;
    top: calc(100% + 4px);
    left: 8px;
    right: 8px;
    z-index: 50;
    background: var(--menu-bg);
    backdrop-filter: blur(10px);
    border: 1px solid var(--line2);
    border-radius: var(--r3);
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.7), 0 0 24px var(--fill-g08);
    padding: 8px;
  }
  .cal-gridhead {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 7px;
  }
  .cal-gridnav {
    width: 24px;
    height: 22px;
    border: 1px solid var(--line1);
    border-radius: var(--r1);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    padding: 0;
  }
  .cal-gridnav:hover {
    background: var(--fill-g14);
  }
  .cal-gridtitle {
    flex: 1;
    text-align: center;
    font-family: var(--num);
    font-weight: 600;
    font-size: 15px;
    color: var(--txt);
    font-variant-numeric: tabular-nums;
  }
  .cal-griddays {
    display: grid;
    gap: 2px;
  }
  .cal-gridday {
    height: 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    border: 1px solid transparent;
    border-radius: var(--r1);
    background: transparent;
    cursor: pointer;
    padding: 0;
  }
  .cal-gridday:hover {
    background: var(--fill-g14);
  }
  .cal-gridday.cal-blank {
    visibility: hidden;
    cursor: default;
  }
  .cal-gridday span {
    font-size: 10px;
    line-height: 1;
    color: var(--txt);
    font-variant-numeric: tabular-nums;
  }
  .cal-gridday.cal-sel {
    background: var(--fill-g22);
    border-color: var(--green);
    box-shadow: var(--cal-glow);
  }
  .cal-gridtoday {
    margin-top: 7px;
    width: 100%;
    height: 24px;
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--green);
    background: var(--fill-g08);
    border: 1px solid var(--line1);
    border-radius: var(--r1);
    cursor: pointer;
  }
  .cal-gridtoday:hover {
    background: var(--fill-g14);
  }

  /* timeline */
  .cal-timeline {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .cal-tlhead {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px 5px;
  }
  .cal-tllabel {
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--faint);
  }
  .cal-tlhint {
    font-size: 9px;
    color: var(--faint);
    opacity: 0.8;
  }
  .cal-zoom {
    display: flex;
    align-items: center;
    border: 1px solid var(--line1);
    border-radius: var(--r2);
    overflow: hidden;
    height: 22px;
  }
  .cal-zoom button {
    height: 22px;
    padding: 0 7px;
    border: none;
    cursor: pointer;
    font-size: 9.5px;
    letter-spacing: 0.04em;
    font-variant-numeric: tabular-nums;
    color: var(--faint);
    background: transparent;
  }
  .cal-zoom button:hover {
    color: var(--txt);
  }
  .cal-zoom button.cal-active {
    background: var(--fill-g22);
    color: var(--green);
    font-weight: 700;
  }
  .cal-tlscroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
    border-top: 1px solid var(--line1);
  }
  .cal-tlinner {
    position: relative;
    cursor: copy;
  }
  .cal-slotline {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1px solid var(--cal-line-faint);
    pointer-events: none;
  }
  .cal-slotline.cal-hour {
    border-top-color: var(--line1);
  }
  .cal-slotlabel {
    position: absolute;
    left: 12px;
    top: 2px;
    font-size: 9.5px;
    color: var(--faint);
    opacity: 0.6;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.03em;
  }
  .cal-slotlabel.cal-hour {
    color: var(--faint);
    opacity: 1;
  }
  .cal-nowband {
    position: absolute;
    left: 0;
    right: 0;
    height: 36px;
    background: linear-gradient(180deg, var(--fill-g08), transparent);
    pointer-events: none;
  }
  .cal-nowline {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--green);
    box-shadow: 0 0 10px var(--fill-g22), 0 0 22px var(--fill-g14);
    animation: cal-nowpulse 2.8s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes cal-nowpulse {
    0%,
    100% {
      opacity: 0.95;
    }
    50% {
      opacity: 0.5;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .cal-nowline {
      animation: none;
      opacity: 0.9;
    }
  }
  .cal-nowbadge {
    position: absolute;
    right: 6px;
    padding: 2px 6px;
    font-size: 9px;
    letter-spacing: 0.1em;
    color: var(--ink);
    background: var(--green);
    border-radius: var(--r1);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
    box-shadow: 0 0 12px var(--fill-g22);
  }
  .cal-chip {
    position: absolute;
    left: 52px;
    right: 10px;
    height: 20px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 7px;
    background: var(--fill-g14);
    border: 1px solid var(--line1);
    border-left: 2px solid var(--green);
    border-radius: var(--r1);
    cursor: pointer;
    z-index: 3;
    text-align: left;
    font: inherit;
  }
  .cal-chip:hover {
    background: var(--fill-g22);
    border-color: var(--line2);
  }
  .cal-chiptime {
    font-family: var(--num);
    font-weight: 700;
    font-size: 12px;
    color: var(--green);
    font-variant-numeric: tabular-nums;
    flex: none;
  }
  .cal-chiptitle {
    font-size: 11px;
    color: var(--txt);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cal-editcard {
    position: absolute;
    left: 48px;
    right: 8px;
    z-index: 10;
    background: var(--bg1);
    border: 1px solid var(--line2);
    border-left: 2px solid var(--green);
    border-radius: var(--r2);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6);
    padding: 7px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    cursor: default;
  }
  .cal-edittitle {
    height: 24px;
    padding: 0 7px;
    font-size: 11px;
    color: var(--txt);
    background: var(--fill-g08);
    border: 1px solid var(--line1);
    border-radius: var(--r1);
    outline: none;
    font: inherit;
  }
  .cal-editrow {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .cal-edittime {
    height: 24px;
    padding: 0 5px;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--green);
    background: var(--fill-g08);
    border: 1px solid var(--line1);
    border-radius: var(--r1);
    outline: none;
    font: inherit;
  }
  .cal-editdel {
    height: 24px;
    padding: 0 8px;
    font-size: 10px;
    letter-spacing: 0.06em;
    color: var(--red);
    background: transparent;
    border: 1px solid var(--red-dim);
    border-radius: var(--r1);
    cursor: pointer;
  }
  .cal-editdel:hover {
    background: var(--fill-red);
  }
  .cal-editdone {
    height: 24px;
    padding: 0 10px;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink);
    background: var(--green);
    border: none;
    border-radius: var(--r1);
    cursor: pointer;
    font-weight: 700;
  }
  .cal-editdone:hover {
    background: var(--eye);
  }

  /* upcoming */
  .cal-upcoming {
    flex: none;
    border-top: 1px solid var(--line1);
    padding: 6px 12px 5px;
    max-height: 124px;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .cal-uplabel {
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--faint);
    margin-bottom: 4px;
    flex: none;
  }
  .cal-uplist {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .cal-upnone {
    font-size: 10.5px;
    color: var(--faint);
    padding: 4px 0 6px;
  }
  .cal-uprow {
    display: grid;
    grid-template-columns: 52px 40px 1fr;
    align-items: center;
    gap: 6px;
    padding: 3px 4px;
    border-radius: var(--r1);
    cursor: pointer;
    background: transparent;
    border: none;
    width: 100%;
    text-align: left;
    font: inherit;
  }
  .cal-uprow:hover {
    background: var(--fill-g08);
  }
  .cal-upwhen {
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--gold);
    white-space: nowrap;
    overflow: hidden;
  }
  .cal-upwhen.cal-today {
    color: var(--green);
  }
  .cal-uptime {
    font-family: var(--num);
    font-weight: 700;
    font-size: 12.5px;
    color: var(--green);
    font-variant-numeric: tabular-nums;
  }
  .cal-uptitle {
    font-size: 11px;
    color: var(--txt);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* footer */
  .cal-foot {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px 6px;
    border-top: 1px solid var(--line1);
    background: rgba(0, 0, 0, 0.25);
  }
  .cal-calsel {
    flex: 1;
    min-width: 0;
    height: 22px;
    font-size: 10px;
    color: var(--muted);
    background: var(--bg1);
    border: 1px solid var(--line1);
    border-radius: var(--r1);
    outline: none;
    padding: 0 4px;
  }
  .cal-yearin {
    width: 64px;
    height: 22px;
    padding: 0 6px;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: var(--txt);
    background: var(--bg1);
    border: 1px solid var(--line1);
    border-radius: var(--r1);
    outline: none;
  }
  .cal-era {
    font-size: 9px;
    letter-spacing: 0.1em;
    color: var(--faint);
  }
</style>
