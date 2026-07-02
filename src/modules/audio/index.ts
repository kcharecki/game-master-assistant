import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';
import Editor from './Editor.svelte';

const audio: ModuleManifest = {
  id: 'audio',
  title: 'Audio',
  size: { w: 380, h: 520 },
  desktop: Desktop,
  editor: Editor,
  broadcastable: true,
};

export default audio;
