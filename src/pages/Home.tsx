import { Settings } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import { CustomIcon } from '../components/CustomIcon';
import { AlyneWordmark } from '../components/AlyneWordmark';
import { Avatar } from '../components/Avatar';
import { supabase, getPartnerSnapshot, type PartnerSnapshot } from '../lib/supabase';
import { goalLabel } from '../lib/goals';
import { useAuth } from '../contexts/useAuth';
import { todayLocalDate } from '../lib/dates';
import { checkedInMessage } from '../lib/checkedInMessage';
import { PartnerCheckIn } from '../components/PartnerCheckIn';

const CARD_SHADOW = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.07)';

export default function Home() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [snapshot, setSnapshot] = useState<PartnerSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getPartnerSnapshot().then((result) => {
      if (!active) return;
      setSnapshot(result);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  }

  if (loading) return null;

  // No partner yet — her design has a dedicated screen for this.
  if (!snapshot) return <Navigate to="/home-empty" replace />;

  const myStreak = profile?.current_streak ?? 0;
  const checkedInToday = profile?.last_check_in_date === todayLocalDate();
  const partnerName = snapshot.partner.displayName ?? 'Your partner';
  const partnerStreak = snapshot.partner.currentStreak;
  const partnerLast = snapshot.partnerLatestCheckIn;

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
          {checkedInToday
            ? /* Rotates daily through Salomeh's seven variants. Stable within a
                 day, so navigating away and back does not change it. */
              checkedInMessage({
                streak: myStreak,
                partnerName: snapshot.partner.displayName,
                userId: profile?.id ?? null,
              })
            : "Your partner's counting on you today."}
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
                <Avatar
                  src={profile?.avatar_url}
                  name={profile?.display_name}
                  size={80}
                />
                <div
                  className="absolute -bottom-1 -right-1 bg-white rounded-full p-1.5"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
                >
                  <CustomIcon size={13} color="#104241" />
                </div>
              </div>
              <p className="mt-3 text-[0.9rem]" style={{ color: '#2B2B2B', fontWeight: 500 }}>
                You
              </p>
              <p className="text-[0.82rem]" style={{ color: '#8A8580' }}>
                {myStreak} {myStreak === 1 ? 'day' : 'days'}
              </p>
            </div>

            {/* Divider */}
            <div className="h-px w-8 rounded-full" style={{ backgroundColor: '#a8893f' }} />

            {/* Partner */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <Avatar
                  src={snapshot.partner.avatarUrl}
                  name={snapshot.partner.displayName}
                  size={80}
                />
                <div
                  className="absolute -bottom-1 -right-1 bg-white rounded-full p-1.5"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
                >
                  <CustomIcon size={13} color="#A8893F" />
                </div>
              </div>
              <p className="mt-3 text-[0.9rem]" style={{ color: '#2B2B2B', fontWeight: 500 }}>
                {partnerName}
              </p>
              <p className="text-[0.82rem]" style={{ color: '#8A8580' }}>
                {partnerStreak} {partnerStreak === 1 ? 'day' : 'days'}
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
              {goalLabel(snapshot.goal)}
            </p>
          </div>
        </div>

        {/* Check In CTA */}
        <Link to="/check-in">
          <button
            className="w-full transition-all duration-200 active:scale-[0.98] mb-6 disabled:opacity-60"
            disabled={checkedInToday}
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
            {checkedInToday ? 'Checked In Today' : 'Check In Today'}
          </button>
        </Link>

        {/* Partner activity — the check-in itself, not just when it happened. */}
        {partnerLast ? (
          <PartnerCheckIn checkIn={partnerLast} partnerName={partnerName} />
        ) : (
          <p className="text-center text-[0.9rem] mb-8 leading-relaxed" style={{ color: '#8A8580' }}>
            {partnerName} hasn&apos;t checked in yet.<br />
            Be the one who goes first.
          </p>
        )}

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
              {myStreak}
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
              {partnerStreak}
            </p>
            <p className="text-[0.8rem]" style={{ color: '#8A8580' }}>{partnerName}'s streak</p>
          </div>
        </div>

        {/* Check-in state */}
        {!checkedInToday && (
          <p className="text-center mt-6 text-[0.85rem]" style={{ color: '#A8893F' }}>
            You haven't checked in yet today.
          </p>
        )}

        {/* Sign out — a button, never a Link: react-router prefetches Link
            targets, which would fire a sign-out the user never clicked. */}
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={handleSignOut}
            className="text-[0.85rem]"
            style={{ color: '#8A8580' }}
          >
            Sign out
          </button>
        </div>

      </div>
    </div>
  );
}
