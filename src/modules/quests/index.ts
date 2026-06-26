import type { ModuleManifest } from '../../lib/module';
import Desktop from './Desktop.svelte';

const quests: ModuleManifest = {
  id: 'quests',
  title: 'Quest Tracker',
  size: { w: 330, h: 320 },
  desktop: Desktop,
};

export default quests;
