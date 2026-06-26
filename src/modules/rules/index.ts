import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const rules: ModuleManifest = {
  id: 'rules',
  title: 'Rules Reference',
  size: { w: 320, h: 300 },
  desktop: Desktop,
};

export default rules;
