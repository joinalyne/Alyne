import { Link } from 'react-router'
import { AlyneCustomIcon } from '../components/alyne/AlyneCustomIcon'
import { ImageWithFallback } from '../components/alyne/ImageWithFallback'

/** Home dashboard from Figma Make — @see https://www.figma.com/make/GEiM8YhB9h1opQNaQ7FGLH/Design-Alyne-Home-Screen */
export default function Home() {
  const currentUser = {
    name: 'You',
    photo:
      'https://images.unsplash.com/photo-1581564018992-95e729d4940e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYXBweSUyMHdvbWFuJTIwcG9ydHJhaXQlMjBuYXR1cmFsfGVufDF8fHx8MTc3NTA2ODc4Nnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    streak: 7,
  }

  const partner = {
    name: 'Jamie',
    photo:
      'https://images.unsplash.com/photo-1640653583383-72b60809f273?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmllbmRseSUyMG1hbiUyMHBvcnRyYWl0JTIwc21pbGluZ3xlbnwxfHx8fDE3NzUwNjg3ODd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    streak: 12,
    lastCheckIn: '2 hours ago',
  }

  const sharedGoal = 'Practice daily meditation'

  return (
    <div className="flex min-h-dvh items-start justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-8 pt-12">
        <div className="text-center">
          <ImageWithFallback src="/alyne-logo.png" alt="Alyne" className="mx-auto w-28" />
        </div>

        <div className="text-center">
          <p className="text-[0.95rem] text-[#2b2b2b]/60">Your partner&apos;s counting on you today.</p>
        </div>

        <div
          className="rounded-[1.75rem] bg-white p-8 shadow-sm"
          style={{ boxShadow: '0 2px 16px rgba(43, 43, 43, 0.04)' }}
        >
          <div className="mb-6 flex items-center justify-center gap-6">
            <div className="flex flex-col items-center">
              <div className="relative">
                <img
                  src={currentUser.photo}
                  alt={currentUser.name}
                  className="h-20 w-20 rounded-full object-cover"
                  style={{ border: '3px solid #104241' }}
                />
                <div className="absolute -bottom-1 -right-1 rounded-full bg-white p-1.5 shadow-sm">
                  <AlyneCustomIcon size={14} color="#104241" />
                </div>
              </div>
              <p className="mt-3 text-[0.9rem] font-medium text-[#2b2b2b]">{currentUser.name}</p>
              <p className="text-[0.85rem] text-[#2b2b2b]/60">{currentUser.streak} days</p>
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
                  className="h-20 w-20 rounded-full object-cover"
                  style={{ border: '3px solid #a8893f' }}
                />
                <div className="absolute -bottom-1 -right-1 rounded-full bg-white p-1.5 shadow-sm">
                  <AlyneCustomIcon size={14} color="#a8893f" />
                </div>
              </div>
              <p className="mt-3 text-[0.9rem] font-medium text-[#2b2b2b]">{partner.name}</p>
              <p className="text-[0.85rem] text-[#2b2b2b]/60">{partner.streak} days</p>
            </div>
          </div>

          <div
            className="border-t pt-4 text-center"
            style={{ borderColor: 'rgba(43, 43, 43, 0.08)' }}
          >
            <p
              className="mb-2 text-[0.8rem] uppercase tracking-wide text-[#2b2b2b]/50"
              style={{ letterSpacing: '0.08em' }}
            >
              Shared Goal
            </p>
            <p className="text-[1.05rem] font-medium text-[#2b2b2b]">{sharedGoal}</p>
          </div>
        </div>

        <Link to="/check-in" className="block">
          <span
            className="flex w-full items-center justify-center rounded-[1.25rem] py-5 text-[1.1rem] font-semibold text-white transition-all duration-200 active:scale-[0.98]"
            style={{
              backgroundColor: '#104241',
              boxShadow: '0 4px 20px rgba(16, 66, 65, 0.25)',
            }}
          >
            Check In Today
          </span>
        </Link>

        <div className="px-4 pt-6 text-center">
          <p className="text-[0.95rem] leading-relaxed text-[#2b2b2b]/65">
            {partner.name} checked in {partner.lastCheckIn}. <br />
            Keep your streak going! 🌱
          </p>
        </div>

        <div className="flex items-center justify-center gap-8 pt-4">
          <div className="text-center">
            <div
              className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: '#f0f0f0' }}
            >
              <AlyneCustomIcon size={24} color="#104241" />
            </div>
            <p className="mb-0.5 text-[1.5rem] font-bold text-[#104241]">{currentUser.streak}</p>
            <p className="text-[0.8rem] text-[#2b2b2b]/60">Your streak</p>
          </div>

          <div className="text-center">
            <div
              className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: '#f0f0f0' }}
            >
              <AlyneCustomIcon size={24} color="#a8893f" />
            </div>
            <p className="mb-0.5 text-[1.5rem] font-bold text-[#a8893f]">{partner.streak}</p>
            <p className="text-[0.8rem] text-[#2b2b2b]/60">{partner.name}&apos;s streak</p>
          </div>
        </div>
      </div>
    </div>
  )
}
