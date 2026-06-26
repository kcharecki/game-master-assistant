import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const reminders: ModuleManifest = {
  id: 'reminders',
  title: 'Action Reminders',
  size: { w: 300, h: 260 },
  desktop: Desktop,
};

export default reminders;
