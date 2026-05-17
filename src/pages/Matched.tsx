import { Link } from 'react-router'
import { ImageWithFallback } from '../components/alyne/ImageWithFallback'

export default function Matched() {
  const currentUser = {
    name: 'You',
    photo:
      'https://images.unsplash.com/photo-1581564018992-95e729d4940e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYXBweSUyMHdvbWFuJTIwcG9ydHJhaXQlMjBuYXR1cmFsfGVufDF8fHx8MTc3NTA2ODc4Nnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  }

  const partner = {
    name: 'Jamie',
    photo:
      'https://images.unsplash.com/photo-1640653583383-72b60809f273?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmllbmRseSUyMG1hbiUyMHBvcnRyYWl0JTIwc21pbGluZ3xlbnwxfHx8fDE3NzUwNjg3ODd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  }

  const sharedGoal = 'Practice daily meditation'

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <ImageWithFallback src="/alyne-logo.png" alt="Alyne" className="mx-auto w-24" />
        </div>

        <div className="flex items-center justify-center gap-5">
          <div className="flex flex-col items-center">
            <img
              src={currentUser.photo}
              alt={currentUser.name}
              className="h-20 w-20 rounded-full object-cover"
              style={{ border: '3px solid #104241' }}
            />
          </div>

          <div
            className="h-[1px] w-8 rounded-full"
            style={{ backgroundColor: '#104241', opacity: 0.3 }}
            aria-hidden
          />

          <div className="flex flex-col items-center">
            <img
              src={partner.photo}
              alt={partner.name}
              className="h-20 w-20 rounded-full object-cover"
              style={{ border: '3px solid #104241' }}
            />
          </div>
        </div>

        <div className="space-y-2 text-center">
          <h1
            className="text-[1.4rem] font-semibold leading-tight tracking-tight"
            style={{ color: '#a8893f' }}
          >
            You&apos;ve been matched with {partner.name}!
          </h1>
          <p className="px-4 text-[0.95rem] leading-snug text-[#2b2b2b]/70">
            You&apos;re both working toward the same goal. Now hold each other to it.
          </p>
        </div>

        <div
          className="rounded-[1.5rem] bg-white p-4 text-center"
          style={{ boxShadow: '0 2px 16px rgba(43, 43, 43, 0.04)' }}
        >
          <p
            className="mb-1 text-[0.7rem] uppercase tracking-wide text-[#2b2b2b]/50"
            style={{ letterSpacing: '0.08em' }}
          >
            Shared Goal
          </p>
          <p className="text-[1rem] font-medium text-[#2b2b2b]">{sharedGoal}</p>
        </div>

        <div className="space-y-2">
          <Link to="/home" className="block">
            <span
              className="flex w-full items-center justify-center rounded-[1.25rem] py-3.5 text-[1.05rem] font-bold text-white transition-all duration-200 active:scale-[0.98]"
              style={{
                backgroundColor: '#104241',
                boxShadow: '0 4px 20px rgba(16, 66, 65, 0.25)',
              }}
            >
              Say Hello 👋
            </span>
          </Link>
          <p className="text-center text-[0.8rem] text-[#2b2b2b]/50">
            {partner.name} will be notified that you&apos;ve matched.
          </p>
        </div>
      </div>
    </div>
  )
}
