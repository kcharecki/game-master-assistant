import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';
import Rolodex from './Rolodex.svelte';

const npcs: ModuleManifest = {
  id: 'npcs',
  title: 'NPCs',
  size: { w: 300, h: 248 },
  desktop: Desktop,
  editor: Rolodex,
};

export default npcs;
