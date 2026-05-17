import { BookOpen, Check, Dumbbell, MoreHorizontal, PenLine, Sparkles, Unlock } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'

export default function GoalSelection() {
  const navigate = useNavigate()
  const [selectedGoal, setSelectedGoal] = useState<string | null>('fitness')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const goals = [
    { id: 'fitness', label: 'Fitness', icon: Dumbbell },
    { id: 'writing', label: 'Writing', icon: PenLine },
    { id: 'learning', label: 'Learning', icon: BookOpen },
    { id: 'quitting', label: 'Quitting', icon: Unlock },
    { id: 'mindfulness', label: 'Mindfulness', icon: Sparkles },
    { id: 'other', label: 'Other', icon: MoreHorizontal },
  ] as const

  async function handleFindPartner() {
    if (!selectedGoal) {
      setError('Please pick a goal first.')
      return
    }

    setError(null)
    setSaving(true)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) {
        void navigate('/')
        return
      }

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({ user_id: user.id, goal: selectedGoal }, { onConflict: 'user_id' })

      if (upsertError) throw upsertError

      void navigate('/finding-partner')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your goal. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-start justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-5 pt-6">
        <div className="space-y-1 px-4 text-center">
          <h1 className="text-[1.55rem] font-semibold leading-tight tracking-tight text-[#2b2b2b]">
            What are you working on?
          </h1>
          <p className="text-[0.9rem] leading-snug text-[#2b2b2b]/60">
            We&apos;ll find you a partner chasing the same thing.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {goals.map((goal) => {
            const Icon = goal.icon
            const isSelected = selectedGoal === goal.id

            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => setSelectedGoal(goal.id)}
                disabled={saving}
                className="relative flex min-h-[108px] flex-col items-center justify-center gap-2 rounded-[1.25rem] bg-white p-4 transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: isSelected ? '2px solid #104241' : '2px solid rgba(43, 43, 43, 0.08)',
                  boxShadow: '0 2px 12px rgba(43, 43, 43, 0.04)',
                }}
              >
                {isSelected ? (
                  <div
                    className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ backgroundColor: '#104241' }}
                  >
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  </div>
                ) : null}

                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: '#f5f3f0' }}
                >
                  <Icon size={20} color="#a8893f" strokeWidth={1.25} />
                </div>

                <p
                  className="text-center text-[0.9rem] leading-snug text-[#2b2b2b]"
                  style={{ fontWeight: isSelected ? 600 : 500 }}
                >
                  {goal.label}
                </p>
              </button>
            )
          })}
        </div>

        {error ? (
          <p
            className="rounded-2xl bg-red-50 px-4 py-2.5 text-center text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleFindPartner}
            disabled={saving || !selectedGoal}
            className="w-full rounded-[1.25rem] py-4 text-[1.05rem] font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            style={{
              backgroundColor: '#104241',
              boxShadow: '0 4px 20px rgba(16, 66, 65, 0.25)',
            }}
          >
            {saving ? 'Saving…' : 'Find My Partner'}
          </button>

          <p className="px-4 text-center text-[0.8rem] leading-snug text-[#2b2b2b]/60">
            Your partner will have the same goal. You&apos;ll be matched within 24 hours.
          </p>
        </div>
      </div>
    </div>
  )
}
