import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const notebook: ModuleManifest = {
  id: 'notebook',
  title: 'Session Notes',
  size: { w: 344, h: 300 },
  desktop: Desktop,
};

export default notebook;
