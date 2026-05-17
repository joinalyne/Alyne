import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AlyneCustomIcon } from '../components/alyne/AlyneCustomIcon'
import { ImageWithFallback } from '../components/alyne/ImageWithFallback'
import { supabase } from '../lib/supabase'

function formatRelative(iso: string) {
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime())
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function isToday(iso: string) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return new Date(iso).getTime() >= start.getTime()
}

function ymdLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function computeStreak(rowsDesc: { created_at: string }[]) {
  if (rowsDesc.length === 0) return 0

  const dates = new Set(rowsDesc.map((r) => ymdLocal(new Date(r.created_at))))

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  let cursor: Date
  if (dates.has(ymdLocal(today))) cursor = new Date(today)
  else if (dates.has(ymdLocal(yesterday))) cursor = new Date(yesterday)
  else return 0

  let streak = 0
  while (dates.has(ymdLocal(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

type LatestCheckIn = { message: string; created_at: string }

/** Home dashboard from Figma Make — @see https://www.figma.com/make/GEiM8YhB9h1opQNaQ7FGLH/Design-Alyne-Home-Screen */
export default function Home() {
  const [latest, setLatest] = useState<LatestCheckIn | null>(null)
  const [streak, setStreak] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) {
        if (!cancelled) setLoaded(true)
        return
      }
      const { data } = await supabase
        .from('checkins')
        .select('message, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(365)

      if (cancelled) return
      const rows = data ?? []
      setLatest(rows[0] ?? null)
      setStreak(computeStreak(rows))
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const currentUser = {
    name: 'You',
    photo:
      'https://images.unsplash.com/photo-1581564018992-95e729d4940e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYXBweSUyMHdvbWFuJTIwcG9ydHJhaXQlMjBuYXR1cmFsfGVufDF8fHx8MTc3NTA2ODc4Nnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  }

  const streakDisplay = streak ?? '—'

  const partner = {
    name: 'Jamie',
    photo:
      'https://images.unsplash.com/photo-1640653583383-72b60809f273?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmllbmRseSUyMG1hbiUyMHBvcnRyYWl0JTIwc21pbGluZ3xlbnwxfHx8fDE3NzUwNjg3ODd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    streak: 12,
    lastCheckIn: '2 hours ago',
  }

  const sharedGoal = 'Practice daily meditation'

  return (
    <div className="flex min-h-dvh items-start justify-center bg-background px-6 pb-6 pt-4">
      <div className="w-full max-w-md space-y-4">
        <div className="space-y-1 text-center">
          <ImageWithFallback src="/alyne-logo.png" alt="Alyne" className="mx-auto w-24" />
          <p className="text-[0.9rem] text-[#2b2b2b]/60">
            Your partner&apos;s counting on you today.
          </p>
        </div>

        <div
          className="rounded-[1.5rem] bg-white p-5"
          style={{ boxShadow: '0 2px 16px rgba(43, 43, 43, 0.04)' }}
        >
          <div className="mb-4 flex items-center justify-center gap-5">
            <div className="flex flex-col items-center">
              <div className="relative">
                <img
                  src={currentUser.photo}
                  alt={currentUser.name}
                  className="h-16 w-16 rounded-full object-cover"
                  style={{ border: '3px solid #104241' }}
                />
                <div className="absolute -bottom-1 -right-1 rounded-full bg-white p-1.5 shadow-sm">
                  <AlyneCustomIcon size={14} color="#104241" />
                </div>
              </div>
              <p className="mt-2 text-[0.9rem] font-medium text-[#2b2b2b]">{currentUser.name}</p>
              <p className="text-[0.85rem] text-[#2b2b2b]/60">{streakDisplay} days</p>
            </div>

            <div
              className="h-0.5 w-8 rounded-full"
              style={{ backgroundColor: '#104241', opacity: 0.2 }}
              aria-hidden
            />

            <div className="flex flex-col items-center">
              <div className="relative">
                <img
                  src={partner.photo}
                  alt={partner.name}
                  className="h-16 w-16 rounded-full object-cover"
                  style={{ border: '3px solid #a8893f' }}
                />
                <div className="absolute -bottom-1 -right-1 rounded-full bg-white p-1.5 shadow-sm">
                  <AlyneCustomIcon size={14} color="#a8893f" />
                </div>
              </div>
              <p className="mt-2 text-[0.9rem] font-medium text-[#2b2b2b]">{partner.name}</p>
              <p className="text-[0.85rem] text-[#2b2b2b]/60">{partner.streak} days</p>
            </div>
          </div>

          <div
            className="border-t pt-3 text-center"
            style={{ borderColor: 'rgba(43, 43, 43, 0.08)' }}
          >
            <p
              className="mb-1 text-[0.7rem] uppercase tracking-wide text-[#2b2b2b]/50"
              style={{ letterSpacing: '0.08em' }}
            >
              Shared Goal
            </p>
            <p className="text-[1rem] font-medium text-[#2b2b2b]">{sharedGoal}</p>
          </div>
        </div>

        <Link to="/check-in" className="block">
          <span
            className="flex w-full items-center justify-center rounded-[1.25rem] py-4 text-[1.05rem] font-semibold text-white transition-all duration-200 active:scale-[0.98]"
            style={{
              backgroundColor: '#104241',
              boxShadow: '0 4px 20px rgba(16, 66, 65, 0.25)',
            }}
          >
            Check In Today
          </span>
        </Link>

        <p className="text-center text-[0.85rem] leading-snug text-[#2b2b2b]/65">
          {partner.name} checked in {partner.lastCheckIn}. Keep your streak going! 🌱
        </p>

        <div className="flex items-center justify-center gap-8">
          <div className="text-center">
            <div
              className="mb-1 inline-flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: '#f0f0f0' }}
            >
              <AlyneCustomIcon size={22} color="#104241" />
            </div>
            <p className="text-[1.25rem] font-bold leading-tight text-[#104241]">
              {streakDisplay}
            </p>
            <p className="text-[0.75rem] text-[#2b2b2b]/60">Your streak</p>
          </div>

          <div className="text-center">
            <div
              className="mb-1 inline-flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: '#f0f0f0' }}
            >
              <AlyneCustomIcon size={22} color="#a8893f" />
            </div>
            <p className="text-[1.25rem] font-bold leading-tight text-[#a8893f]">
              {partner.streak}
            </p>
            <p className="text-[0.75rem] text-[#2b2b2b]/60">{partner.name}&apos;s streak</p>
          </div>
        </div>

        {loaded ? (
          latest && isToday(latest.created_at) ? (
            <div
              className="rounded-[1.25rem] bg-white p-4"
              style={{ boxShadow: '0 2px 12px rgba(43, 43, 43, 0.04)' }}
            >
              <p
                className="mb-1 text-[0.7rem] uppercase tracking-wide text-[#2b2b2b]/50"
                style={{ letterSpacing: '0.08em' }}
              >
                Your last check-in
              </p>
              <p className="mb-1 text-[0.95rem] leading-snug text-[#2b2b2b]">
                {latest.message}
              </p>
              <p className="text-[0.75rem] text-[#2b2b2b]/55">
                {formatRelative(latest.created_at)}
              </p>
            </div>
          ) : (
            <p className="text-center text-[0.9rem] text-[#2b2b2b]/65">
              You haven&apos;t checked in yet today.
            </p>
          )
        ) : null}
      </div>
    </div>
  )
}
