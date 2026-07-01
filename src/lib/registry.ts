import type { ModuleId, ModuleManifest } from './module';
import handouts from '../modules/handouts';
import initiative from '../modules/initiative';
import timer from '../modules/timer';
import roller from '../modules/roller';
import npcs from '../modules/npcs';
import lore from '../modules/lore';
import calendar from '../modules/calendar';
import schedule from '../modules/schedule';
import reveal from '../modules/reveal';
import map from '../modules/map';
import audio from '../modules/audio';
import sanity from '../modules/sanity';
import notebook from '../modules/notebook';
import palette from '../modules/palette';
import rules from '../modules/rules';
import stage from '../modules/stage';
import preview from '../modules/preview';

/** The single source of truth: id -> module. Surfaces resolve views from here. */
export const modules: Record<ModuleId, ModuleManifest> = {
  initiative,
  timer,
  roller,
  npcs,
  lore,
  calendar,
  schedule,
  reveal,
  map,
  audio,
  handouts,
  notebook,
  sanity,
  palette,
  rules,
  stage,
  preview,
};

export const moduleList: ModuleManifest[] = Object.values(modules);

export function getModule(id: ModuleId): ModuleManifest {
  return modules[id];
}
