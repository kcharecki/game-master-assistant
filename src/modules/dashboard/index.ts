import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const dashboard: ModuleManifest = {
  id: 'dashboard',
  title: 'Player Dashboard',
  size: { w: 340, h: 280 },
  desktop: Desktop,
};

export default dashboard;
