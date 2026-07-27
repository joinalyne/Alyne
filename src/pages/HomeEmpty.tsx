import { Settings, UserRound, Bell } from 'lucide-react';
import { Link } from 'react-router';
import { AlyneWordmark } from '../components/AlyneWordmark';

const CARD_SHADOW = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.07)';

export default function HomeEmpty() {
  const currentUser = {
    name: "You",
    photo: "https://images.unsplash.com/photo-1581564018992-95e729d4940e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400",
  };

  return (
    <div className="min-h-screen flex items-start justify-center p-6 bg-background">
      <div className="w-full max-w-md pt-12">

        {/* Logo + settings */}
        <div className="relative flex items-center justify-center mb-3">
          <AlyneWordmark className="w-24 mx-auto" />
          <Link
            to="/settings"
            className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10"
          >
            <Settings size={22} strokeWidth={1.5} color="#2B2B2B" />
          </Link>
        </div>

        {/* Subtitle */}
        <p className="text-center text-[0.95rem] mb-10" style={{ color: '#8A8580' }}>
          Your partner is on their way.
        </p>

        {/* Partner card — empty state */}
        <div
          className="mb-6"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '1.25rem',
            padding: '36px 28px',
            boxShadow: CARD_SHADOW,
          }}
        >
          {/* Avatars */}
          <div className="flex items-center justify-center gap-8 mb-6">
            {/* You */}
            <div className="flex flex-col items-center">
              <img
                src={currentUser.photo}
                alt={currentUser.name}
                className="w-20 h-20 rounded-full object-cover"
                style={{ border: '3px solid #104241' }}
              />
              <p className="mt-3 text-[0.9rem]" style={{ color: '#2B2B2B', fontWeight: 500 }}>
                {currentUser.name}
              </p>
            </div>

            {/* Divider */}
            <div className="h-px w-8 rounded-full" style={{ backgroundColor: '#a8893f' }} />

            {/* Placeholder partner */}
            <div className="flex flex-col items-center">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{
                  border: '1px dashed #A8893F',
                  backgroundColor: '#F5F3F0',
                }}
              >
                <UserRound size={26} color="#A8893F" strokeWidth={1} />
              </div>
              <p className="mt-3 text-[0.9rem]" style={{ color: '#8A8580', fontWeight: 500 }}>
                Partner
              </p>
            </div>
          </div>

          {/* Status */}
          <div
            className="text-center pt-5"
            style={{ borderTop: '1px solid rgba(43,43,43,0.07)' }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              {/* Pulsing dot */}
              <span className="relative flex h-2 w-2">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                  style={{ backgroundColor: '#A8893F' }}
                />
                <span
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ backgroundColor: '#A8893F' }}
                />
              </span>
              <p className="text-[0.85rem] uppercase tracking-widest" style={{ color: '#A8893F', fontWeight: 600, letterSpacing: '0.09em' }}>
                Finding your match
              </p>
            </div>
            <p className="text-[0.9rem]" style={{ color: '#8A8580' }}>
              We'll notify you as soon as you're paired.
            </p>
          </div>
        </div>

        {/* What to expect card */}
        <div
          className="mb-8"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '1.25rem',
            padding: '24px',
            boxShadow: CARD_SHADOW,
          }}
        >
          <p
            className="text-[0.75rem] uppercase mb-4"
            style={{ color: '#8A8580', fontWeight: 600, letterSpacing: '0.07em' }}
          >
            What happens next
          </p>
          <div className="space-y-4">
            {[
              { step: '1', text: "We'll match you with someone working toward the same goal." },
              { step: '2', text: "You'll get a notification once your partner is ready." },
              { step: '3', text: "Check in daily — your partner is counting on you." },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-4">
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: '#F5F3F0' }}
                >
                  <span style={{ color: '#A8893F', fontWeight: 700, fontSize: '0.78rem' }}>{step}</span>
                </div>
                <p className="text-[0.9rem] leading-snug" style={{ color: '#2B2B2B' }}>
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Notification nudge */}
        <div className="flex items-center justify-center gap-2">
          <Bell size={15} strokeWidth={1.5} color="#8A8580" />
          <p className="text-[0.82rem]" style={{ color: '#8A8580' }}>
            Make sure notifications are on so you don't miss it.
          </p>
        </div>

      </div>
    </div>
  );
}
