import { AlyneWordmark } from '../components/AlyneWordmark';
import { Avatar } from '../components/Avatar';
import { Link, Navigate } from 'react-router';
import { useEffect, useState } from 'react';
import { getPartnerSnapshot, notifyMatch, type PartnerSnapshot } from '../lib/supabase';
import { goalLabel } from '../lib/goals';
import { useAuth } from '../contexts/useAuth';

export default function Matched() {
  const { profile } = useAuth();
  const [snapshot, setSnapshot] = useState<PartnerSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getPartnerSnapshot().then((result) => {
      if (!active) return;
      setSnapshot(result);
      setLoading(false);
      // Fire and forget. Both partners call this; the database guarantees one
      // email. Not awaited, so a slow mail send never delays the screen.
      if (result) void notifyMatch(result.matchId);
    });
    return () => { active = false; };
  }, []);

  if (loading) return null;

  // Landing here without a match means the match ended, or the URL was typed
  // directly. Home handles the unmatched state properly, so defer to it.
  if (!snapshot) return <Navigate to="/home" replace />;

  const partnerName = snapshot.partner.displayName ?? 'your partner';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">

        {/* Logo */}
        <div className="text-center">
          <AlyneWordmark className="w-24 mx-auto" />
        </div>

        {/* Profile Photos */}
        <div className="flex items-center justify-center gap-6 pt-4">
          {/* Current User */}
          <div className="flex flex-col items-center">
            <Avatar src={profile?.avatar_url} name={profile?.display_name} size={96} />
          </div>

          {/* Connector Line */}
          <div className="h-[1px] w-10 rounded-full" style={{ backgroundColor: '#a8893f' }}></div>

          {/* Partner */}
          <div className="flex flex-col items-center">
            <Avatar
              src={snapshot.partner.avatarUrl}
              name={snapshot.partner.displayName}
              size={96}
            />
          </div>
        </div>

        {/* Headline */}
        <div className="text-center space-y-3 pt-2">
          <h1
            className="text-[1.45rem] tracking-tight leading-tight"
            style={{ color: '#a8893f', fontWeight: 600 }}
          >
            You've been matched with {partnerName}!
          </h1>
          <p
            className="text-[1.05rem] leading-relaxed px-4"
            style={{ color: '#8A8580' }}
          >
            You're both working toward the same goal. Now hold each other to it.
          </p>
        </div>

        {/* Shared Goal Card */}
        <div className="bg-white rounded-[1.25rem] p-6 text-center" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.07)' }}>
          <p className="text-[0.75rem] uppercase tracking-wide mb-3" style={{ color: '#8A8580', fontWeight: 600, letterSpacing: '0.07em' }}>
            Shared Goal
          </p>
          <p className="text-[1.1rem]" style={{ color: '#2b2b2b', fontWeight: 500 }}>
            {goalLabel(snapshot.goal)}
          </p>
        </div>

        {/* CTA Button */}
        <div className="space-y-3 pt-4">
          <Link to="/home">
            <button
              className="w-full rounded-[1.25rem] py-4 transition-all duration-200 active:scale-[0.98]"
              style={{
                backgroundColor: '#104241',
                color: '#FFFFFF',
                fontSize: '1.05rem',
                fontWeight: 700,
                boxShadow: '0 4px 20px rgba(16, 66, 65, 0.25)'
              }}
            >
              Say Hello 👋
            </button>
          </Link>
          <p className="text-center text-[0.85rem] pt-4" style={{ color: '#8A8580' }}>
            {partnerName} has been notified that you've matched.
          </p>
        </div>

      </div>
    </div>
  );
}
