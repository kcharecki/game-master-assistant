import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const composer: ModuleManifest = {
  id: 'composer',
  title: 'Broadcast Composer',
  size: { w: 640, h: 460 },
  desktop: Desktop,
  broadcastable: true,
};

export default composer;
