import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import Asset1 from '../imports/Asset_1-1.svg';
import Asset2 from '../imports/Asset_2.svg';
import { AlyneWordmark } from '../components/AlyneWordmark';
import { enqueueAndMatch } from '../lib/supabase';

/** How often to re-check while waiting for someone to join the queue. */
const POLL_MS = 5000;

/**
 * The animation is the point of this screen, and a match can land instantly
 * when someone is already waiting. Hold briefly so it plays rather than
 * flashing past — "Good things take a moment", as the copy says.
 */
const MINIMUM_DWELL_MS = 2600;

export default function FindingPartner() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // Stamped inside the effect, not at render: Date.now() during render is
  // impure and makes the component non-deterministic across re-renders.
  const startedAt = useRef(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    if (!startedAt.current) startedAt.current = Date.now();

    async function attempt() {
      try {
        // Idempotent: joins the queue on the first call, and on later calls
        // picks up a match the *other* side created. That is what makes plain
        // polling sufficient here without realtime subscriptions.
        const matchId = await enqueueAndMatch();
        if (!active) return;

        if (matchId) {
          const elapsed = Date.now() - startedAt.current;
          const wait = Math.max(0, MINIMUM_DWELL_MS - elapsed);
          timer = setTimeout(() => {
            if (active) navigate('/matched', { replace: true });
          }, wait);
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
      <div className="w-full max-w-md space-y-10 text-center">

        {/* Logo */}
        <motion.div
          className="flex justify-center pt-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <AlyneWordmark className="w-24" />
        </motion.div>

        {/* Animated Illustration */}
        <div className="flex items-center justify-center py-8">
          <div className="relative w-[280px] h-[140px]">
            {/* Left Profile Silhouette */}
            <motion.div
              className="absolute left-0 top-1/2 -translate-y-1/2"
              style={{ width: '70px', height: '77px' }}
              initial={{ opacity: 0, x: -20 }}
              animate={{
                opacity: 1,
                x: 0,
                y: [0, -5, 0]
              }}
              transition={{
                opacity: { duration: 0.8, ease: "easeOut" },
                x: { duration: 0.8, ease: "easeOut" },
                y: {
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1
                }
              }}
            >
              <img src={Asset1} alt="" className="w-full h-full" />
            </motion.div>

            {/* Right Profile Silhouette */}
            <motion.div
              className="absolute right-0 top-1/2 -translate-y-1/2"
              style={{ width: '70px', height: '77px' }}
              initial={{ opacity: 0, x: 20 }}
              animate={{
                opacity: 1,
                x: 0,
                y: [0, -5, 0]
              }}
              transition={{
                opacity: { duration: 0.8, ease: "easeOut", delay: 0.2 },
                x: { duration: 0.8, ease: "easeOut", delay: 0.2 },
                y: {
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1.3
                }
              }}
            >
              <img src={Asset2} alt="" className="w-full h-full" />
            </motion.div>

            {/* Connecting Line with Animation */}
            <svg
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              width="120"
              height="2"
              viewBox="0 0 120 2"
            >
              <motion.line
                x1="0"
                y1="1"
                x2="120"
                y2="1"
                stroke="#a8893f"
                strokeWidth="1"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{
                  pathLength: 1,
                  opacity: [1, 0.4, 1]
                }}
                transition={{
                  pathLength: { duration: 1.2, ease: "easeOut", delay: 0.6 },
                  opacity: {
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1.5
                  }
                }}
              />
            </svg>

            {/* Pulsing Dots */}
            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8 }}
            >
              <div className="flex gap-1.5">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: '#a8893f' }}
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: '#a8893f' }}
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                />
                <motion.div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: '#a8893f' }}
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-4 px-4">
          <motion.h1
            className="text-[2rem] tracking-tight leading-tight"
            style={{ color: '#2b2b2b', fontWeight: 600 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            Finding your person<motion.span
              style={{ color: '#a8893f' }}
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
            >.</motion.span>
          </motion.h1>

          {error ? (
            <p
              role="alert"
              className="mx-2 rounded-[1.25rem] px-5 py-3 text-[0.9rem]"
              style={{ backgroundColor: '#fdf2f2', color: '#9b2c2c' }}
            >
              {error}
            </p>
          ) : (
            <>
              <motion.p
                className="text-[1rem] leading-relaxed px-2"
                style={{ color: '#8A8580' }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1 }}
              >
                We're looking for someone with the same goal. We'll notify you the moment we find a match — usually within 24 hours.
              </motion.p>

              <motion.p
                className="text-[0.9rem] italic pt-2"
                style={{ color: '#a8893f' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                transition={{ duration: 0.6, delay: 1.2 }}
              >
                Good things take a moment.
              </motion.p>

              <motion.p
                className="text-[1rem] leading-relaxed px-2"
                style={{ color: '#8A8580' }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.4 }}
              >
                We'll email you the moment we find your match.
              </motion.p>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
