<script lang="ts">
  import { clearBroadcast } from './bus-actions';
  import { t } from '../../lib/i18n';
</script>

<p class="muted" style="font-size:13px; margin-bottom:12px">
  {t('reveal.widgetIntroPre')}<strong style="color:var(--green)">{t('reveal.widgetIntroLink')}</strong
  >{t('reveal.widgetIntroPost')}
</p>
<button class="btn" onclick={clearBroadcast}>{t('reveal.clearBroadcast')}</button>
