import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const audio: ModuleManifest = {
  id: 'audio',
  title: 'Audio',
  size: { w: 360, h: 560 },
  desktop: Desktop,
  broadcastable: true,
};

export default audio;
