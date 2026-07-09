import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const initiative: ModuleManifest = {
  id: 'initiative',
  title: 'Initiative Tracker',
  size: { w: 340, h: 440 },
  desktop: Desktop,
};

export default initiative;
