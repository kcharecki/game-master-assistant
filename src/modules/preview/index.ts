import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const preview: ModuleManifest = {
  id: 'preview',
  title: 'Broadcast Preview',
  size: { w: 340, h: 250 },
  desktop: Desktop,
};

export default preview;
