import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const sanity: ModuleManifest = {
  id: 'sanity',
  title: 'Sanity',
  size: { w: 300, h: 280 },
  desktop: Desktop,
};

export default sanity;
