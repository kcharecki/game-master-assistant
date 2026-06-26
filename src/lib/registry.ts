import type { ModuleId, ModuleManifest } from './module';
import handouts from '../modules/handouts';
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
import notebook from '../modules/notebook';
import quests from '../modules/quests';
import beats from '../modules/beats';
import tables from '../modules/tables';
import improv from '../modules/improv';
import palette from '../modules/palette';
import archive from '../modules/archive';
import spotlight from '../modules/spotlight';
import rules from '../modules/rules';
import dashboard from '../modules/dashboard';
import reminders from '../modules/reminders';

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
  handouts,
  notebook,
  quests,
  beats,
  tables,
  improv,
  clues,
  sanity,
  skillcheck,
  statblock,
  palette,
  archive,
  spotlight,
  rules,
  dashboard,
  reminders,
};

export const moduleList: ModuleManifest[] = Object.values(modules);

export function getModule(id: ModuleId): ModuleManifest {
  return modules[id];
}
