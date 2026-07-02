<!-- Flickering candle loader for busy/loading states. Pure CSS animation
     (see .candle in app.css), frozen under prefers-reduced-motion. -->
<script lang="ts">
  import { t } from '../lib/i18n';

  let { size = 26, label }: { size?: number; label?: string } = $props();
</script>

<span
  class="candle"
  style="width:{(size * 18) / 26}px;height:{size}px"
  role="status"
  aria-label={label ?? t('atmos.loading')}
  title={label ?? t('atmos.loading')}
>
  <svg viewBox="0 0 18 26" width="100%" height="100%" fill="none" aria-hidden="true">
    <!-- outer flame -->
    <path
      class="flame"
      d="M9 2c3 3 4 5.5 4 8a4 4 0 0 1-8 0c0-2 1-3.6 2-5 .4 1 1 1.6 1.6 1.8C8.4 5.6 8 3.8 9 2z"
      fill="#e8a13a"
    />
    <!-- inner core -->
    <path class="flame-core" d="M9 7c1.6 1.6 2 3 2 4.4a2 2 0 0 1-4 0C7 10 8 8.4 9 7z" fill="#fbe6a0" />
    <!-- wax body -->
    <rect x="6" y="14" width="6" height="11" rx="1.5" fill="#cbb98a" />
    <rect x="6" y="14" width="6" height="3" rx="1.5" fill="#b3a06e" />
    <line x1="9" y1="12.5" x2="9" y2="14" stroke="#3a2c14" stroke-width="1" stroke-linecap="round" />
  </svg>
</span>
