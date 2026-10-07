import { AlyneWordmark } from '../components/AlyneWordmark';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { supabase, ensureProfile } from '../lib/supabase';
import { Alert } from '../components/Alert';
import { PasswordField } from '../components/PasswordField';
import { trackSignup } from '../lib/pixels';

const CARD_SHADOW = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.07)';

/** Cream fill, no visible edge until focus — see PasswordField's 'filled'. */
const fieldClass =
  'w-full px-6 py-4 text-[1rem] rounded-[18px] border-[1.5px] border-transparent ' +
  'transition-all duration-200 focus:outline-none focus:border-[#1A3328]';
const fieldStyle = { color: '#2b2b2b', backgroundColor: '#FAF8F5' };

export default function Auth() {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Send the user wherever their onboarding actually left off. */
  async function routeAfterSignIn(userId: string) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, current_goal')
      .eq('id', userId)
      .maybeSingle();

    if (!profile?.display_name) return navigate('/profile-setup');
    if (!profile.current_goal) return navigate('/goal-selection');
    return navigate('/home');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trimmedEmail = email.trim();

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          // Origin-derived rather than hardcoded: the pre-M1 code pointed at a
          // preview deployment URL, so confirmation links sent from production
          // would have taken the user to the wrong host.
          options: { emailRedirectTo: `${window.location.origin}/` },
        });

        if (signUpError) throw signUpError;

        // Supabase returns success with an empty identities array when the
        // address is already registered, rather than erroring. Without this
        // check the user waits for an email that was never sent.
        if (data.user && data.user.identities?.length === 0) {
          setIsSignUp(false);
          throw new Error('That email is already registered. Log in instead.');
        }

        if (data.user) window.posthog?.identify(data.user.id);
        window.posthog?.capture('signed_up');
        // Tells Reddit and Meta which ad click this was, so the auction can
        // optimise towards signups rather than towards clicks.
        trackSignup();
        // With email confirmation disabled the session arrives immediately.
        if (data.session) {
          await ensureProfile();
          return navigate('/profile-setup');
        }

        return navigate('/check-email', { state: { email: trimmedEmail } });
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) throw signInError;

      if (data.session) {
                window.posthog?.identify(data.session.user.id);
        await ensureProfile();
        await routeAfterSignIn(data.session.user.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: '#FAF8F5' }}
    >
      <div className="w-full max-w-md">
        {/* Salomeh's ad-landing redesign, folded into this screen rather than
            living at a second route: `/` has to stay the one place a signup can
            happen, or the signup handler, the already-registered case and the
            conversion pixel would all have to be duplicated — and a landing page
            whose CTA cannot actually create an account converts nothing. */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            padding: '40px 32px 36px',
            boxShadow: CARD_SHADOW,
          }}
        >
          {/* Logo */}
          <div className="text-center mb-10">
            <AlyneWordmark className="w-24 mx-auto" />
          </div>

          {/* In sign-up mode this answers "what am I looking at" before asking
              for an email, in the same words as the ad that brought them here.
              Returning users logging in need none of it. */}
          {isSignUp ? (
            <>
              <h1
                className="text-center mb-4"
                style={{
                  color: '#A8893F',
                  fontSize: '1.85rem',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                Week three is where it usually dies.
              </h1>
              <p
                className="text-center mb-4"
                style={{ color: '#2B2B2B', fontSize: '1rem', lineHeight: 1.65 }}
              >
                Not because the plan was wrong &mdash; because nobody noticed when you
                skipped.
              </p>
              <p
                className="text-center mb-8"
                style={{ color: '#8A8580', fontSize: '1rem', lineHeight: 1.65 }}
              >
                Alyne pairs you with one person chasing the same goal. You check in to
                each other, every day.
              </p>
            </>
          ) : (
            <h1
              className="text-center mb-8"
              style={{
                color: '#A8893F',
                fontSize: '1.5rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              Welcome back.
            </h1>
          )}

          {error ? (
            <div className="mb-4">
              <Alert>{error}</Alert>
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              autoComplete="email"
              className={`${fieldClass} mb-3`}
              style={fieldStyle}
            />

            {/* Reveal toggle kept — it is the one thing a password field on a
                phone genuinely needs. */}
            <div className={isSignUp ? 'mb-6' : 'mb-2'}>
              <PasswordField
                variant="filled"
                value={password}
                onChange={setPassword}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
            </div>

            {!isSignUp && (
              <div className="text-right mb-6 px-1">
                <Link
                  to="/reset-password"
                  className="text-[0.875rem]"
                  style={{ fontWeight: 600, color: '#A8893F' }}
                >
                  Forgot password?
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mb-6 transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
              style={{
                backgroundColor: '#104241',
                color: '#FFFFFF',
                borderRadius: '18px',
                padding: '17px',
                fontSize: '1.05rem',
                fontWeight: 700,
                boxShadow: '0 4px 20px rgba(16,66,65,0.25)',
              }}
            >
              {loading ? 'One moment…' : isSignUp ? 'Get Started' : 'Log In'}
            </button>
          </form>

          {/* A button, not an anchor: switching mode must not navigate. */}
          <p className="text-center" style={{ color: '#8A8580', fontSize: '0.9rem' }}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
              style={{ color: '#A8893F', fontWeight: 600 }}
            >
              {isSignUp ? 'Log in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
