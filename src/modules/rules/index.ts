import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';
import Editor from './Editor.svelte';

const rules: ModuleManifest = {
  id: 'rules',
  title: 'Rules & Rulings',
  size: { w: 360, h: 380 },
  desktop: Desktop,
  editor: Editor,
};

export default rules;
