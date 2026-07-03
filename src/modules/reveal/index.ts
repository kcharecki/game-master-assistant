import type { ModuleManifest } from '../../lib/module';
import Editor from './Editor.svelte';

const reveal: ModuleManifest = {
  id: 'reveal',
  title: 'Reveal',
  size: { w: 320, h: 220 },
  editor: Editor,
  broadcastable: true,
};

export default reveal;
