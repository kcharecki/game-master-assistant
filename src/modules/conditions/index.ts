import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const conditions: ModuleManifest = {
  id: 'conditions',
  title: 'Conditions',
  size: { w: 300, h: 320 },
  desktop: Desktop,
};

export default conditions;
