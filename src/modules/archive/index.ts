import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const archive: ModuleManifest = {
  id: 'archive',
  title: 'Campaign Archive',
  size: { w: 344, h: 320 },
  desktop: Desktop,
};

export default archive;
