import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const handouts: ModuleManifest = {
  id: 'handouts',
  title: 'Handouts',
  size: { w: 360, h: 260 },
  desktop: Desktop,
  broadcastable: true,
};

export default handouts;
