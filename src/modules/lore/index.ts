import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';
import Editor from './Editor.svelte';

const lore: ModuleManifest = {
  id: 'lore',
  title: 'Lore Wiki',
  size: { w: 320, h: 280 },
  desktop: Desktop,
  editor: Editor,
};

export default lore;
