import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const improv: ModuleManifest = {
  id: 'improv',
  title: 'Improv Prompt',
  size: { w: 280, h: 180 },
  desktop: Desktop,
};

export default improv;
