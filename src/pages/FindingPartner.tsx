import { motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import Asset1 from '../imports/Asset_1-1.svg';
import Asset2 from '../imports/Asset_2.svg';
import { AlyneWordmark } from '../components/AlyneWordmark';
import { enqueueAndMatch } from '../lib/supabase';
import { Alert } from '../components/Alert';

// ─────────────────────────────────────────────────────────────────────────────
// Salomeh's v2 visual layer (30 July) over the existing logic.
//
// Her file was presentation only and said so: "keep whatever routing/data hooks
// the current screen has". Dropping it in wholesale would have removed the
// polling that actually creates matches, and the back control that stops someone
// being stranded here, so the two are merged rather than replaced.
//
// Her file imports the wordmark as a default export; this repo exports it named,
// so that is corrected rather than copied.
// ─────────────────────────────────────────────────────────────────────────────

/** How often to re-check while waiting for someone to join the queue. */
const POLL_MS = 5000;

/**
 * The animation is the point of this screen, and a match can land instantly when
 * someone is already waiting. Hold briefly so it plays rather than flashing past.
 */
const MINIMUM_DWELL_MS = 2600;

export default function FindingPartner() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // Stamped inside the effect, not at render: calling a clock during render is
  // impure and makes the component non-deterministic.
  const startedAt = useRef(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    if (!startedAt.current) startedAt.current = Date.now();

    async function attempt() {
      try {
        // Idempotent: joins the queue on the first call, and on later calls picks
        // up a match the OTHER side created. That is what makes plain polling
        // sufficient without realtime subscriptions.
        const matchId = await enqueueAndMatch();
        if (!active) return;

        if (matchId) {
          const elapsed = Date.now() - startedAt.current;
          timer = setTimeout(
            () => { if (active) navigate('/matched', { replace: true }); },
            Math.max(0, MINIMUM_DWELL_MS - elapsed),
          );
          return;
        }

        timer = setTimeout(attempt, POLL_MS);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : 'Could not start the search. Please try again.',
        );
      }
    }

    void attempt();

    return () => {
      active = false;
      clearTimeout(timer);
      // Deliberately NOT leaving the queue on unmount. The user stays queued
      // after closing the app and gets an email when a partner appears.
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      {/* A way out. This screen had no navigation at all, and on the installed
          PWA there is no browser chrome either, so someone waiting was stuck.
          Leaving does NOT cancel the search, exactly as the copy below promises. */}
      <button
        type="button"
        onClick={() => navigate('/home')}
        aria-label="Back"
        className="fixed top-6 left-6 flex items-center justify-center w-10 h-10"
      >
        <ChevronLeft size={24} strokeWidth={1.5} color="#2B2B2B" />
      </button>

      <div className="w-full max-w-md space-y-10 text-center">

        {/* Logo */}
        <motion.div
          className="flex justify-center pt-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <AlyneWordmark className="w-28" />
        </motion.div>

        {/* Animated Illustration */}
        <div className="flex items-center justify-center py-8">
          <div className="relative w-[280px] h-[140px]">

            {/* Left Profile Silhouette */}
            <motion.div
              className="absolute left-0 top-1/2 -translate-y-1/2"
              style={{ width: '70px', height: '77px' }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0, y: [0, -5, 0] }}
              transition={{
                opacity: { duration: 0.8, ease: 'easeOut' },
                x: { duration: 0.8, ease: 'easeOut' },
                y: { duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 1 },
              }}
            >
              <img src={Asset1} alt="" className="w-full h-full" />
            </motion.div>

            {/* Right Profile Silhouette */}
            <motion.div
              className="absolute right-0 top-1/2 -translate-y-1/2"
              style={{ width: '70px', height: '77px' }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0, y: [0, -5, 0] }}
              transition={{
                opacity: { duration: 0.8, ease: 'easeOut', delay: 0.2 },
                x: { duration: 0.8, ease: 'easeOut', delay: 0.2 },
                y: { duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 1.3 },
              }}
            >
              <img src={Asset2} alt="" className="w-full h-full" />
            </motion.div>

            {/* Connecting Line */}
            <svg
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              width="120"
              height="2"
              viewBox="0 0 120 2"
            >
              <motion.line
                x1="0" y1="1" x2="120" y2="1"
                stroke="#a8893f" strokeWidth="1" strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.6 }}
              />
            </svg>

            {/* Travelling dots along the line */}
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute top-1/2 left-1/2 rounded-full"
                style={{
                  width: 6, height: 6, background: '#A8893F',
                  translateY: '-50%', marginLeft: -60,
                }}
                initial={{ opacity: 0 }}
                animate={{ x: [0, 120], opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 2.4, repeat: Infinity, ease: 'easeInOut',
                  delay: 1.6 + i * 0.35,
                }}
              />
            ))}
          </div>
        </div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="space-y-4"
        >
          <h1 className="text-[2rem] tracking-tight" style={{ color: '#2B2B2B', fontWeight: 600 }}>
            Finding your person<span style={{ color: '#A8893F' }}>.</span>
          </h1>
          {error ? (
            <Alert>{error}</Alert>
          ) : (
            <p
              className="text-[1.05rem] leading-relaxed mx-auto"
              style={{ color: '#2B2B2B', maxWidth: '380px' }}
            >
              We&rsquo;re looking for someone with the same goal. We&rsquo;ll notify you the
              moment we find a match &mdash; usually within 24 hours.
            </p>
          )}
        </motion.div>

        {/* Reassurance */}
        {error ? null : (
          <motion.p
            className="text-[1rem] italic"
            style={{ color: '#A8893F' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.4 }}
          >
            Good things take a moment.
          </motion.p>
        )}

      </div>
    </div>
  );
}
