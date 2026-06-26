import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const statblock: ModuleManifest = {
  id: 'statblock',
  title: 'Stat Blocks',
  size: { w: 340, h: 440 },
  desktop: Desktop,
};

export default statblock;
