import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const skillcheck: ModuleManifest = {
  id: 'skillcheck',
  title: 'Skill Check',
  size: { w: 300, h: 300 },
  desktop: Desktop,
};

export default skillcheck;
