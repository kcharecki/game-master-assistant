import type { ModuleManifest } from '../../lib/module';

/**
 * The command palette is a global overlay (Ctrl/Cmd+K), not a windowed widget,
 * so it exposes no surface views — it is registered only so its id is part of
 * the closed ModuleId union and the feature maps to a module.
 */
const palette: ModuleManifest = {
  id: 'palette',
  title: 'Command Palette',
  size: { w: 560, h: 400 },
};

export default palette;
