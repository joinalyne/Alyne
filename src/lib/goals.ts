import type { Goal } from './supabase';

/**
 * Display labels for the six goals.
 *
 * Deliberately the plain goal name rather than an invented phrase. The mock
 * showed "Practice daily meditation" as the shared goal, but no such field
 * exists — goals are a fixed enum of six. Writing a descriptive sentence here
 * would be inventing product copy that Salomeh has not asked for.
 */
export const GOAL_LABELS: Record<Goal, string> = {
  fitness: 'Fitness',
  writing: 'Writing',
  learning: 'Learning',
  quitting: 'Quitting',
  mindfulness: 'Mindfulness',
  other: 'Other',
};

export function goalLabel(goal: Goal | string | null): string {
  if (!goal) return 'Not set';
  return GOAL_LABELS[goal as Goal] ?? 'Other';
}
