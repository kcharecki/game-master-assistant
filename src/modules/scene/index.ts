import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const scene: ModuleManifest = {
  id: 'scene',
  title: 'Current Scene',
  size: { w: 344, h: 432 },
  desktop: Desktop,
};

export default scene;
