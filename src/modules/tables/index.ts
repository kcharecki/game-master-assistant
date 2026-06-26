import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const tables: ModuleManifest = {
  id: 'tables',
  title: 'Tables & Rulings',
  size: { w: 330, h: 340 },
  desktop: Desktop,
};

export default tables;
