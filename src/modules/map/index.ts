import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const map: ModuleManifest = {
  id: 'map',
  title: 'Battle Map',
  size: { w: 520, h: 420 },
  desktop: Desktop,
  broadcastable: true,
};

export default map;
