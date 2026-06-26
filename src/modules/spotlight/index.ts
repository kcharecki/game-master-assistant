import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const spotlight: ModuleManifest = {
  id: 'spotlight',
  title: 'Spotlight',
  size: { w: 320, h: 280 },
  desktop: Desktop,
};

export default spotlight;
