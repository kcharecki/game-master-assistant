import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const schedule: ModuleManifest = {
  id: 'schedule',
  title: 'Timeline',
  size: { w: 340, h: 440 },
  desktop: Desktop,
};

export default schedule;
