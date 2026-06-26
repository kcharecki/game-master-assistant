import type { ModuleId, ModuleManifest } from './module';
import scene from '../modules/scene';
import initiative from '../modules/initiative';
import conditions from '../modules/conditions';
import timer from '../modules/timer';
import roller from '../modules/roller';
import npcs from '../modules/npcs';
import lore from '../modules/lore';
import calendar from '../modules/calendar';
import factions from '../modules/factions';
import reveal from '../modules/reveal';
import map from '../modules/map';
import audio from '../modules/audio';
import sanity from '../modules/sanity';
import clues from '../modules/clues';
import skillcheck from '../modules/skillcheck';
import statblock from '../modules/statblock';

function stub(
  id: ModuleId,
  title: string,
  w: number,
  h: number,
  extra: Partial<ModuleManifest> = {}
): ModuleManifest {
  return { id, title, size: { w, h }, ...extra };
}

/** The single source of truth: id -> module. Surfaces resolve views from here. */
export const modules: Record<ModuleId, ModuleManifest> = {
  scene,
  initiative,
  conditions,
  timer,
  roller,
  npcs,
  lore,
  calendar,
  factions,
  reveal,
  map,
  audio,
  handouts: stub('handouts', 'Handouts', 318, 236),
  notebook: stub('notebook', 'Notebook', 344, 186),
  clues,
  sanity,
  skillcheck,
  statblock,
};

export const moduleList: ModuleManifest[] = Object.values(modules);

export function getModule(id: ModuleId): ModuleManifest {
  return modules[id];
}
