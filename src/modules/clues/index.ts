import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const clues: ModuleManifest = {
  id: 'clues',
  title: 'Clue Board',
  size: { w: 380, h: 320 },
  desktop: Desktop,
};

export default clues;
