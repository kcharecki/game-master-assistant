<script lang="ts">
  import { onMount } from 'svelte';
  import { calendar } from './store.svelte';
  import { formatDate, type MoonPhase } from './logic';
  import { t } from '../../lib/i18n';

  onMount(() => void calendar.load());

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

  // Map a moon-phase enum to its translation key (display only; the stored
  // value stays the English enum used for glyph lookup and logic).
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
</script>

<div class="cal">
  <div class="now">
    <div class="date">{calendar.label}</div>
    <div class="moon"><span class="glyph">{GLYPH[calendar.moon]}</span>{t(MOON_KEY[calendar.moon])}</div>
  </div>

  <div class="adv">
    <button class="btn sm" onclick={() => calendar.advanceBy(-1)}>{t('calendar.prevDay')}</button>
    <button class="btn sm" onclick={() => calendar.advanceBy(1)}>{t('calendar.nextDay')}</button>
    <button class="btn sm" onclick={() => calendar.advanceBy(7)}>{t('calendar.week')}</button>
  </div>

  <div class="events">
    <span class="lbl">{t('calendar.upcoming')}</span>
    {#if calendar.upcoming.length}
      <ul>
        {#each calendar.upcoming as e (e.id)}
          <li>
            <span class="ed">{formatDate(e.date)}</span>
            <span class="et">{e.title}</span>
            <button class="x" title={t('calendar.remove')} aria-label={t('calendar.removeEvent')} onclick={() => calendar.removeEvent(e.id)}>×</button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted">{t('calendar.nothingScheduled')}</p>
    {/if}
    <button class="btn sm add" onclick={() => calendar.addEvent({ ...calendar.current }, t('calendar.newEvent'))}>
      {t('calendar.addEvent')}
    </button>
  </div>
</div>

<style>
  .cal {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    overflow: auto;
  }
  .now {
    text-align: center;
    padding: 6px 0 10px;
    border-bottom: 1px solid var(--line);
  }
  .date {
    font-family: Georgia, serif;
    font-size: 19px;
    color: #e9f3ed;
  }
  .moon {
    margin-top: 4px;
    color: var(--gold);
    font-size: 13px;
  }
  .glyph {
    margin-right: 6px;
    font-size: 15px;
  }
  .adv {
    display: flex;
    gap: 6px;
    justify-content: center;
  }
  .events .lbl {
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .events ul {
    list-style: none;
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .events li {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 13px;
  }
  .ed {
    color: var(--green);
    white-space: nowrap;
  }
  .et {
    color: var(--txt);
    text-align: right;
    flex: 1;
  }
  .x {
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
  }
  .x:hover {
    color: var(--red);
  }
  .add {
    margin-top: 8px;
    align-self: flex-start;
  }
</style>
