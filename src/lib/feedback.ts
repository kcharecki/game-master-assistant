import type { ModuleId } from './module';

/** A piece of feedback the GM left for the programmer about a component. */
export interface FeedbackItem {
  id: string;
  module: ModuleId;
  title: string;
  text: string;
  at: number;
}

/**
 * Render feedback as markdown grouped by component, so the programmer sees
 * exactly which elements to fix per component. Pure — unit-tested, no DOM.
 */
export function feedbackToMarkdown(items: FeedbackItem[]): string {
  if (items.length === 0) return '# Component Feedback\n\n_No feedback yet._\n';

  const groups = new Map<string, FeedbackItem[]>();
  for (const it of items) {
    const key = `${it.title} (${it.module})`;
    const list = groups.get(key) ?? [];
    list.push(it);
    groups.set(key, list);
  }

  let out = '# Component Feedback\n';
  for (const [heading, list] of groups) {
    out += `\n## ${heading}\n`;
    for (const it of [...list].sort((a, b) => a.at - b.at)) {
      out += `- ${it.text}\n`;
    }
  }
  return out;
}
