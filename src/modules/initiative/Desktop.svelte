<script lang="ts">
  const order = [
    { i: 'WH', n: 'William Harcourt', r: 'Investigator', v: 65, active: true, foe: false },
    { i: 'ER', n: 'Dr. Evelyn Reed', r: 'Investigator', v: 48, active: false, foe: false },
    { i: 'FM', n: 'Father Mateo', r: 'Investigator', v: 37, active: false, foe: false },
    { i: 'SM', n: 'Silas Marsh', r: 'Investigator', v: 22, active: false, foe: false },
    { i: 'DO', n: 'Deep One Hybrid', r: 'Monster', v: 12, active: false, foe: true },
  ];
</script>

{#each order as c (c.n)}
  <div class="combatant" class:active={c.active} class:foe={c.foe}>
    <span class="av">{c.i}</span>
    <span class="cn"><div class="nm">{c.n}</div><div class="rl">{c.r}</div></span>
    <span class="iv">{c.v}</span>
  </div>
{/each}
