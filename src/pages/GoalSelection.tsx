import { Dumbbell, PenLine, BookOpen, Unlock, Sparkles, MoreHorizontal, Check } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { updateGoal, type Goal } from '../lib/supabase';
import { useAuth } from '../contexts/useAuth';

export default function GoalSelection() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();

  const [picked, setPicked] = useState<Goal | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived rather than synced from an effect. The profile loads asynchronously,
  // so an effect that copies it into state would briefly show 'fitness' to
  // someone who chose writing, and fight the user's click on a late re-render.
  const selectedGoal: Goal = picked ?? (profile?.current_goal as Goal) ?? 'fitness';

  // Ids match the `goal` enum in the database exactly — they are written
  // straight to profiles.current_goal, so a rename here is a migration.
  const goals: { id: Goal; label: string; icon: typeof Dumbbell }[] = [
    { id: 'fitness', label: 'Fitness', icon: Dumbbell },
    { id: 'writing', label: 'Writing', icon: PenLine },
    { id: 'learning', label: 'Learning', icon: BookOpen },
    { id: 'quitting', label: 'Quitting', icon: Unlock },
    { id: 'mindfulness', label: 'Mindfulness', icon: Sparkles },
    { id: 'other', label: 'Other', icon: MoreHorizontal },
  ];

  const handleGoalSelect = (goalId: Goal) => {
    setPicked(goalId);
  };

  const handleFindPartner = async () => {
    setError(null);
    setSaving(true);
    try {
      // The goal must be persisted before /finding-partner runs the engine:
      // enqueue_and_match() reads current_goal off the profile and refuses to
      // queue anyone who has not chosen one.
      const saved = await updateGoal(selectedGoal);
      if (!saved) throw new Error('Could not save your goal. Please try again.');
      await refreshProfile();
      navigate('/finding-partner');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-6">
      <div className="w-full max-w-md space-y-8 pt-12">

        {/* Header */}
        <div className="text-center space-y-2 px-4">
          <h1 className="text-[1.85rem] tracking-tight leading-tight" style={{ color: '#2b2b2b', fontWeight: 600 }}>
            What are you working on?
          </h1>
          <p className="text-[0.95rem] leading-relaxed" style={{ color: '#8A8580' }}>
            We'll find you a partner chasing the same thing.
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-[1.25rem] px-5 py-3 text-center text-[0.9rem]"
            style={{ backgroundColor: '#fdf2f2', color: '#9b2c2c' }}
          >
            {error}
          </p>
        ) : null}

        {/* Goal Grid */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          {goals.map((goal) => {
            const Icon = goal.icon;
            const isSelected = selectedGoal === goal.id;

            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => handleGoalSelect(goal.id)}
                className="relative bg-white rounded-[1.25rem] p-6 transition-all duration-200 active:scale-[0.98] flex flex-col items-center justify-center gap-3 min-h-[140px]"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: isSelected ? '1.5px solid #1A3328' : '1.5px solid transparent',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.07)'
                }}
              >
                {/* Checkmark for selected state */}
                {isSelected && (
                  <div
                    className="absolute top-3 right-3 flex items-center justify-center w-6 h-6 rounded-full"
                    style={{ backgroundColor: '#104241' }}
                  >
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  </div>
                )}

                {/* Icon */}
                <div
                  className="flex items-center justify-center w-14 h-14 rounded-full"
                  style={{ backgroundColor: '#f5f3f0' }}
                >
                  <Icon
                    size={24}
                    color="#A8893F"
                    strokeWidth={1.5}
                  />
                </div>

                {/* Label */}
                <p
                  className="text-[0.95rem] text-center leading-snug"
                  style={{
                    color: '#2b2b2b',
                    fontWeight: isSelected ? 600 : 500
                  }}
                >
                  {goal.label}
                </p>
              </button>
            );
          })}
        </div>

        {/* Find Partner Button */}
        <div className="space-y-3 pt-6">
          <button
            type="button"
            onClick={handleFindPartner}
            disabled={saving}
            className="w-full rounded-[1.25rem] py-5 transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
            style={{
              backgroundColor: '#104241',
              color: '#FFFFFF',
              fontSize: '1.1rem',
              fontWeight: 700,
              boxShadow: '0 4px 20px rgba(16, 66, 65, 0.25)'
            }}
          >
            {saving ? 'One moment…' : 'Find My Partner'}
          </button>

          <p className="text-center text-[0.85rem] px-4 leading-relaxed" style={{ color: '#8A8580' }}>
            Your partner will have the same goal. <br />
            You'll be matched within 24 hours.
          </p>
        </div>
      </div>
    </div>
  );
}
