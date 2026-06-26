import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const timer: ModuleManifest = {
  id: 'timer',
  title: 'Session Timer',
  size: { w: 280, h: 300 },
  desktop: Desktop,
};

export default timer;
