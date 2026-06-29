import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const stage: ModuleManifest = {
  id: 'stage',
  title: 'Broadcast Stage',
  size: { w: 720, h: 560 },
  desktop: Desktop,
  broadcastable: true,
};

export default stage;
