import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';
import Editor from './Editor.svelte';

const notebook: ModuleManifest = {
  id: 'notebook',
  title: 'Session Notes',
  size: { w: 344, h: 300 },
  desktop: Desktop,
  editor: Editor,
};

export default notebook;
