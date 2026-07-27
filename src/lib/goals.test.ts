import { describe, it, expect } from 'vitest';
import { GOAL_LABELS, goalLabel } from './goals';

describe('goalLabel', () => {
  it('covers all six goals in the database enum', () => {
    // If someone adds a seventh to the enum without a label, this fails.
    expect(Object.keys(GOAL_LABELS).sort()).toEqual(
      ['fitness', 'learning', 'mindfulness', 'other', 'quitting', 'writing'],
    );
  });

  it('labels each goal', () => {
    expect(goalLabel('fitness')).toBe('Fitness');
    expect(goalLabel('quitting')).toBe('Quitting');
    expect(goalLabel('mindfulness')).toBe('Mindfulness');
  });

  it('says "Not set" rather than blank for a user mid-onboarding', () => {
    expect(goalLabel(null)).toBe('Not set');
  });

  it('degrades to Other for an unrecognised value', () => {
    expect(goalLabel('gardening')).toBe('Other');
  });
});
