import { Settings, UserRound, Bell } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import { enqueueAndMatch, getRequeueNotice, type RequeueNotice } from '../lib/supabase';
import { useAuth } from '../contexts/useAuth';
import { Avatar } from '../components/Avatar';
import { AlyneWordmark } from '../components/AlyneWordmark';

const CARD_SHADOW = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.07)';

/**
 * Gentler than FindingPartner's poll. That screen is a few seconds of held
 * attention; this one is where somebody sits for hours or days.
 */
const POLL_MS = 20_000;

export default function HomeEmpty() {
  const navigate = useNavigate();
  // The user's own profile, not a stock portrait. This screen is what someone
  // sees while waiting for a partner, so it is the first thing a brand new
  // signup looks at — showing them a stranger's face is a poor welcome.
  const { profile } = useAuth();

  // Salomeh's one-time notice. Shown once per requeue event, then not again.
  //
  // "Seen" is keyed on the ENDED MATCH ID rather than a plain boolean, so a
  // later requeue notifies afresh instead of being swallowed by a stale flag.
  // A new match clears it without any bookkeeping, because requeue_notice()
  // returns nothing once the user is matched again.
  const [notice, setNotice] = useState<RequeueNotice | null>(null);

  /**
   * Make sure the person looking at this screen is ACTUALLY in the queue.
   *
   * This screen promises "Finding your match" and "We'll notify you as soon as
   * you're paired", but it used to do neither: enqueueing happened only on
   * FindingPartner, which is a screen you pass through once, straight after
   * picking a goal. Anything that interrupted that single moment left the user
   * with a goal, no match and no queue row, and nothing ever retried. Every
   * later visit routed Home -> here, which reassured them while nothing at all
   * was happening.
   *
   * Salomeh's Mia account sat in exactly that state for four days, invisible
   * because the screen looked correct. She only noticed when a friend signed up
   * on the same goal and no match happened.
   *
   * enqueue_and_match() is idempotent: a partial unique index keeps one waiting
   * row, and it returns any existing match rather than double-pairing. So
   * calling it on mount is safe, and it heals anyone already stranded the next
   * time they open the app.
   */
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function ensureQueued() {
      try {
        const matchId = await enqueueAndMatch();
        if (!active) return;
        if (matchId) {
          navigate('/matched', { replace: true });
          return;
        }
      } catch {
        // Deliberately swallowed. A transient failure must not strand someone
        // again, and there is nothing useful to show on a waiting screen, so
        // the retry below IS the error handling.
      }
      if (active) timer = setTimeout(ensureQueued, POLL_MS);
    }

    void ensureQueued();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [navigate]);

  useEffect(() => {
    let active = true;
    getRequeueNotice().then((result) => {
      if (!active || !result) return;
      let alreadySeen = false;
      try {
        alreadySeen = localStorage.getItem('alyne:requeue-seen') === result.matchId;
      } catch {
        // Private browsing can refuse reads. Showing it again is a far smaller
        // harm than never explaining the requeue at all.
      }
      if (alreadySeen) return;
      setNotice(result);
      // Marked on first render, per her spec: no dismiss button, and it reverts
      // to the normal state on the next visit.
      try {
        localStorage.setItem('alyne:requeue-seen', result.matchId);
      } catch { /* nothing useful to do */ }
    });
    return () => { active = false; };
  }, []);

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
          {notice ? "We're finding you a new partner." : 'Your partner is on their way.'}
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
              <Avatar src={profile?.avatar_url} name={profile?.display_name} size={80} />
              <p className="mt-3 text-[0.9rem]" style={{ color: '#2B2B2B', fontWeight: 500 }}>
                You
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
                {notice ? 'A New Match Is Coming' : 'Finding your match'}
              </p>
            </div>
            {notice ? (
              <p
                className="text-[0.9rem] mx-auto"
                style={{ color: '#2B2B2B', lineHeight: 1.55, maxWidth: '280px' }}
              >
                {notice.reason === 'goal_change'
                  ? "Your partner switched goals — life happens. We're already finding you someone new, and you've kept your place in line."
                  : "Your previous pairing has ended — we're already finding you a new partner, and you've kept your place in line."}
              </p>
            ) : (
              <p className="text-[0.9rem]" style={{ color: '#8A8580' }}>
                We'll notify you as soon as you're paired.
              </p>
            )}
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
