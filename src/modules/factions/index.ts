import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const factions: ModuleManifest = {
  id: 'factions',
  title: 'Factions',
  size: { w: 300, h: 380 },
  desktop: Desktop,
};

export default factions;
