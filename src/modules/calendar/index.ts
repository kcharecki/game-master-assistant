import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const calendar: ModuleManifest = {
  id: 'calendar',
  title: 'Calendar',
  size: { w: 360, h: 520 },
  desktop: Desktop,
};

export default calendar;
