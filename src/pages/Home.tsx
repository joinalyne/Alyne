import { Settings } from 'lucide-react';
import { Link } from 'react-router';
import { CustomIcon } from '../components/CustomIcon';
import { AlyneWordmark } from '../components/AlyneWordmark';

const CARD_SHADOW = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.07)';

export default function Home() {
  const currentUser = {
    name: "You",
    photo: "https://images.unsplash.com/photo-1581564018992-95e729d4940e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYXBweSUyMHdvbWFuJTIwcG9ydHJhaXQlMjBuYXR1cmFsfGVufDF8fHx8MTc3NTA2ODc4Nnww&ixlib=rb-4.1.0&q=80&w=400",
    streak: 0,
    checkedInToday: false,
  };

  const partner = {
    name: "Jamie",
    photo: "https://images.unsplash.com/photo-1640653583383-72b60809f273?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmllbmRseSUyMG1hbiUyMHBvcnRyYWl0JTIwc21pbGluZ3xlbnwxfHx8fDE3NzUwNjg3ODd8MA&ixlib=rb-4.1.0&q=80&w=400",
    streak: 12,
    checkedInToday: true,
    lastCheckIn: "2 hours ago",
  };

  const sharedGoal = "Practice daily meditation";

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
        <p className="text-center text-[0.95rem] mb-8" style={{ color: '#8A8580' }}>
          Your partner's counting on you today.
        </p>

        {/* Partner card */}
        <div
          className="mb-6"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '1.25rem',
            padding: '32px 28px',
            boxShadow: CARD_SHADOW,
          }}
        >
          {/* Avatars */}
          <div className="flex items-center justify-center gap-8 mb-6">
            {/* You */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <img
                  src={currentUser.photo}
                  alt={currentUser.name}
                  className="w-20 h-20 rounded-full object-cover"
                  style={{ border: '3px solid #104241' }}
                />
                <div
                  className="absolute -bottom-1 -right-1 bg-white rounded-full p-1.5"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
                >
                  <CustomIcon size={13} color="#104241" />
                </div>
              </div>
              <p className="mt-3 text-[0.9rem]" style={{ color: '#2B2B2B', fontWeight: 500 }}>
                {currentUser.name}
              </p>
              <p className="text-[0.82rem]" style={{ color: '#8A8580' }}>
                {currentUser.streak} days
              </p>
            </div>

            {/* Divider */}
            <div className="h-px w-8 rounded-full" style={{ backgroundColor: '#a8893f' }} />

            {/* Partner */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <img
                  src={partner.photo}
                  alt={partner.name}
                  className="w-20 h-20 rounded-full object-cover"
                  style={{ border: '3px solid #A8893F' }}
                />
                <div
                  className="absolute -bottom-1 -right-1 bg-white rounded-full p-1.5"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
                >
                  <CustomIcon size={13} color="#A8893F" />
                </div>
              </div>
              <p className="mt-3 text-[0.9rem]" style={{ color: '#2B2B2B', fontWeight: 500 }}>
                {partner.name}
              </p>
              <p className="text-[0.82rem]" style={{ color: '#8A8580' }}>
                {partner.streak} days
              </p>
            </div>
          </div>

          {/* Shared goal */}
          <div
            className="text-center pt-5"
            style={{ borderTop: '1px solid rgba(43,43,43,0.07)' }}
          >
            <p
              className="text-[0.75rem] uppercase tracking-wide mb-2"
              style={{ color: '#8A8580', fontWeight: 600, letterSpacing: '0.07em' }}
            >
              Shared Goal
            </p>
            <p className="text-[1.1rem]" style={{ color: '#2B2B2B', fontWeight: 500 }}>
              {sharedGoal}
            </p>
          </div>
        </div>

        {/* Check In CTA */}
        <Link to="/check-in">
          <button
            className="w-full transition-all duration-200 active:scale-[0.98] mb-6"
            style={{
              backgroundColor: '#104241',
              color: '#FFFFFF',
              borderRadius: '1.25rem',
              padding: '18px',
              fontSize: '1.1rem',
              fontWeight: 700,
              boxShadow: '0 4px 20px rgba(16,66,65,0.25)',
            }}
          >
            Check In Today
          </button>
        </Link>

        {/* Partner activity */}
        <p className="text-center text-[0.9rem] mb-8 leading-relaxed" style={{ color: '#8A8580' }}>
          {partner.name} checked in {partner.lastCheckIn}.<br />
          Keep your streak going! 🌱
        </p>

        {/* Streak stats */}
        <div className="flex items-center justify-center gap-10">
          <div className="text-center">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-2"
              style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            >
              <CustomIcon size={24} color="#104241" />
            </div>
            <p className="text-[1.5rem]" style={{ color: '#104241', fontWeight: 700 }}>
              {currentUser.streak}
            </p>
            <p className="text-[0.8rem]" style={{ color: '#8A8580' }}>Your streak</p>
          </div>

          <div className="text-center">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-2"
              style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            >
              <CustomIcon size={24} color="#A8893F" />
            </div>
            <p className="text-[1.5rem]" style={{ color: '#A8893F', fontWeight: 700 }}>
              {partner.streak}
            </p>
            <p className="text-[0.8rem]" style={{ color: '#8A8580' }}>{partner.name}'s streak</p>
          </div>
        </div>

        {/* Not checked in yet */}
        <p className="text-center mt-6 text-[0.85rem]" style={{ color: '#A8893F' }}>
          You haven't checked in yet today.
        </p>

        {/* Sign out */}
        <p className="text-center mt-6 text-[0.85rem]" style={{ color: '#8A8580' }}>
          Sign out
        </p>

      </div>
    </div>
  );
}
