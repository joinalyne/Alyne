import { Camera, Edit3, Mic } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'

function startOfTodayIso() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

async function hasCheckedInToday(userId: string) {
  const { data, error } = await supabase
    .from('checkins')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', startOfTodayIso())
    .limit(1)

  if (error) throw error
  return (data?.length ?? 0) > 0
}

export default function CheckIn() {
  const navigate = useNavigate()
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [checkedToday, setCheckedToday] = useState(false)

  const partner = { name: 'Jamie' }

  const today = new Date()
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      try {
        const exists = await hasCheckedInToday(user.id)
        if (!cancelled && exists) setCheckedToday(true)
      } catch {
        // Silently ignore — handleSend re-checks defensively.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const checkInOptions = [
    {
      id: 'photo',
      title: 'Photo',
      subtitle: 'Show us where you are',
      icon: Camera,
      color: '#a8893f',
    },
    {
      id: 'voice',
      title: 'Voice Note',
      subtitle: 'Say how it went',
      icon: Mic,
      color: '#a8893f',
    },
    {
      id: 'text',
      title: 'Quick Update',
      subtitle: 'A few words is enough',
      icon: Edit3,
      color: '#a8893f',
    },
  ] as const

  async function handleSend() {
    if (selectedOption !== 'text') {
      void navigate('/home')
      return
    }

    const trimmed = message.trim()
    if (!trimmed) {
      setError('Add a few words before sending.')
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

      if (await hasCheckedInToday(user.id)) {
        setCheckedToday(true)
        return
      }

      const { error: insertError } = await supabase
        .from('checkins')
        .insert({ user_id: user.id, message: trimmed })

      if (insertError) throw insertError

      setMessage('')
      setSubmitted(true)
      setCheckedToday(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your check-in. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-start justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-4 pt-6">
        <div className="space-y-0.5 text-center">
          <h1 className="text-[1.5rem] font-semibold tracking-tight text-[#2b2b2b]">
            Today&apos;s Check-In
          </h1>
          <p className="text-[0.8rem] text-[#2b2b2b]/50">{dateString}</p>
        </div>

        <div className="space-y-2.5">
          {checkInOptions.map((option) => {
            const Icon = option.icon
            const isSelected = selectedOption === option.id

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedOption(option.id)}
                className="w-full rounded-[1.25rem] bg-white p-4 text-left transition-all duration-200 active:scale-[0.98]"
                style={{
                  boxShadow: '0 2px 12px rgba(43, 43, 43, 0.04)',
                  border: isSelected ? '2px solid #104241' : '2px solid rgba(43, 43, 43, 0.08)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-full"
                    style={{ backgroundColor: '#f5f3f0' }}
                  >
                    <Icon size={20} color={option.color} strokeWidth={1.25} />
                  </div>
                  <div className="flex-1">
                    <p className="mb-0.5 text-[0.95rem] font-semibold text-[#2b2b2b]">
                      {option.title}
                    </p>
                    <p className="text-[0.8rem] text-[#2b2b2b]/60">{option.subtitle}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            maxHeight: selectedOption === 'text' ? '160px' : '0',
            opacity: selectedOption === 'text' ? 1 : 0,
          }}
        >
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
              if (submitted) setSubmitted(false)
            }}
            placeholder="How did it go today?"
            disabled={saving}
            className="w-full resize-none rounded-[1.25rem] border-2 border-[rgba(16,66,65,0.1)] bg-white p-4 text-[0.95rem] text-[#2b2b2b] transition-all focus:outline-none disabled:opacity-60"
            style={{
              minHeight: '96px',
              boxShadow: '0 2px 12px rgba(43, 43, 43, 0.04)',
            }}
            rows={3}
          />
        </div>

        {error ? (
          <p
            className="rounded-2xl bg-red-50 px-4 py-2.5 text-center text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {submitted ? (
          <p
            className="rounded-2xl bg-emerald-50 px-4 py-2.5 text-center text-sm text-emerald-800"
            role="status"
          >
            Check-in sent. {partner.name} will be notified.
          </p>
        ) : checkedToday ? (
          <p
            className="rounded-2xl bg-emerald-50 px-4 py-2.5 text-center text-sm text-emerald-800"
            role="status"
          >
            You&apos;ve already checked in today. See you tomorrow!
          </p>
        ) : null}

        {checkedToday ? null : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleSend}
              disabled={saving}
              className="w-full rounded-[1.25rem] py-4 text-[1.05rem] font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              style={{
                backgroundColor: '#104241',
                boxShadow: '0 4px 20px rgba(16, 66, 65, 0.25)',
              }}
            >
              {saving ? 'Sending…' : `Send to ${partner.name}`}
            </button>

            <p className="text-center text-[0.8rem] text-[#2b2b2b]/50">
              {partner.name} will be notified when you check in.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
