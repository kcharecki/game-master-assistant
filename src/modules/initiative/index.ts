import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const initiative: ModuleManifest = {
  id: 'initiative',
  title: 'Initiative Tracker',
  size: { w: 300, h: 300 },
  desktop: Desktop,
};

export default initiative;
