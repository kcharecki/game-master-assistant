import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';
import Editor from './Editor.svelte';

const planner: ModuleManifest = {
  id: 'planner',
  title: 'Session Planner',
  size: { w: 320, h: 320 },
  desktop: Desktop,
  editor: Editor,
};

export default planner;
