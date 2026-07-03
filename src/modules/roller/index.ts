import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const roller: ModuleManifest = {
  id: 'roller',
  title: 'Quick Roller',
  size: { w: 300, h: 230 },
  desktop: Desktop,
  dock: false,
};

export default roller;
