import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const beats: ModuleManifest = {
  id: 'beats',
  title: 'Beat Planner',
  size: { w: 320, h: 280 },
  desktop: Desktop,
};

export default beats;
