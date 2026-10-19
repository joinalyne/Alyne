import { AlyneWordmark } from '../components/AlyneWordmark';
import { useRef, useState } from 'react';
import { MessageCircle, PenLine, Sun, Target, UsersRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { supabase, ensureProfile } from '../lib/supabase';
import { Alert } from '../components/Alert';
import { PasswordField } from '../components/PasswordField';
import { trackSignup } from '../lib/pixels';
import { Avatar } from '../components/Avatar';

const CARD_SHADOW = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.07)';

/** Cream fill, no visible edge until focus — see PasswordField's 'filled'. */
const fieldClass =
  'w-full px-6 py-4 text-[1rem] rounded-[18px] border-[1.5px] border-transparent ' +
  'transition-all duration-200 focus:outline-none focus:border-[#1A3328]';
const fieldStyle = { color: '#2b2b2b', backgroundColor: '#FAF8F5' };

const GOLD = '#A8893F';
const INK = '#2B2B2B';
/** Darker than the app's usual #8A8580 so small grey text passes 4.5:1. */
const MUTED = '#6B6660';
const CTA_GREEN = '#104241';
const ICON_SURFACE = '#F5F3F0';

const ctaStyle = {
  backgroundColor: CTA_GREEN,
  color: '#FFFFFF',
  borderRadius: '18px',
  padding: '17px',
  fontSize: '1.05rem',
  fontWeight: 700,
  boxShadow: '0 4px 20px rgba(16,66,65,0.25)',
} as const;

const cardStyle = {
  backgroundColor: '#FFFFFF',
  borderRadius: '18px',
  boxShadow: CARD_SHADOW,
} as const;

/**
 * Example people for the partner preview. Illustrative only, never real
 * users. Photos go in public/landing/ — until they are added, Avatar falls
 * back to initials.
 */
const PREVIEW_YOU_PHOTO: string | null = null;
const PREVIEW_PARTNER_PHOTO: string | null = null;

const HOW_IT_WORKS = [
  {
    icon: Target,
    title: 'Pick your goal',
    description: 'Fitness, writing, learning, quitting something, and more.',
  },
  {
    icon: UsersRound,
    title: 'Get matched with one person',
    description:
      'Someone working on the same goal, usually within a day. We email you the moment it happens.',
  },
  {
    icon: MessageCircle,
    title: 'Check in with each other daily',
    description: 'A photo, a voice note or a quick update. Build a streak together.',
  },
];

function PreviewPerson({ name, photo, iconColor }: { name: string; photo: string | null; iconColor: string }) {
  return (
    <div className="flex flex-col items-center" style={{ minWidth: 96 }}>
      <div className="relative">
        <Avatar src={photo} name={name} size={64} borderColor="#1A3328" />
        <div
          className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-white"
          style={{ width: 24, height: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
        >
          <Sun aria-hidden="true" size={14} strokeWidth={1.5} color={iconColor} />
        </div>
      </div>
      <p className="mt-3" style={{ color: INK, fontWeight: 700, lineHeight: 1 }}>{name}</p>
      <p className="mt-1.5 text-[0.875rem]" style={{ color: MUTED, lineHeight: 1 }}>12 days</p>
    </div>
  );
}

/** What a partnership looks like in the app, so "one real person" is shown, not told. */
function PartnerPreview() {
  return (
    <section aria-label="Example accountability partnership" className="px-5 py-5" style={cardStyle}>
      <div className="flex items-start justify-center gap-4">
        <PreviewPerson name="You" photo={PREVIEW_YOU_PHOTO} iconColor={CTA_GREEN} />
        <div className="mt-8 h-px w-7" style={{ backgroundColor: 'rgba(168,137,63,0.6)' }} />
        <PreviewPerson name="Jordan" photo={PREVIEW_PARTNER_PHOTO} iconColor={GOLD} />
      </div>

      <div className="mt-6 pt-4 text-center" style={{ borderTop: '1px solid rgba(43,43,43,0.07)' }}>
        <p className="text-[0.75rem] uppercase" style={{ color: MUTED, fontWeight: 600, letterSpacing: '0.1em' }}>
          Shared goal
        </p>
        <p className="mt-0.5 text-[0.9rem]" style={{ color: INK, fontWeight: 500 }}>Fitness</p>
      </div>

      <div className="mt-5">
        <div className="flex items-center gap-2.5">
          <div
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{ width: 36, height: 36, backgroundColor: ICON_SURFACE }}
          >
            <PenLine aria-hidden="true" size={16} strokeWidth={1.5} color={GOLD} />
          </div>
          <p className="text-[0.875rem]" style={{ color: MUTED }}>Jordan&rsquo;s note · just now</p>
        </div>
        <p className="mt-3" style={{ color: INK, lineHeight: 1.5 }}>Did the 5k. Your turn!</p>
      </div>
    </section>
  );
}

export default function Auth() {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signupRef = useRef<HTMLElement>(null);

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

  const errorAlert = error ? (
    <div className="mb-4">
      <Alert>{error}</Alert>
    </div>
  ) : null;

  // One form for both modes, so sign-up and log-in share the same handler.
  const form = (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        aria-label="Email address"
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
          placeholder={isSignUp ? 'Create a password' : 'Password'}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
        />
      </div>

      {!isSignUp && (
        <div className="text-right mb-6 px-1">
          <Link
            to="/reset-password"
            className="text-[0.875rem]"
            style={{ fontWeight: 600, color: GOLD }}
          >
            Forgot password?
          </Link>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
        style={ctaStyle}
      >
        {loading ? 'One moment…' : isSignUp ? 'Find my partner' : 'Log In'}
      </button>
    </form>
  );

  /* A button, not an anchor: switching mode must not navigate. */
  const switchMode = (
    <p className="text-center" style={{ color: MUTED, fontSize: '0.9rem' }}>
      {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
      <button
        type="button"
        onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
        style={{ color: GOLD, fontWeight: 600 }}
      >
        {isSignUp ? 'Log in' : 'Sign up'}
      </button>
    </p>
  );

  // Returning users: the plain card. They need none of the pitch.
  if (!isSignUp) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#FAF8F5' }}>
        <div className="w-full max-w-md" style={{ ...cardStyle, padding: '40px 32px 36px' }}>
          <div className="text-center mb-10">
            <AlyneWordmark className="w-24 mx-auto" />
          </div>
          <h1
            className="text-center mb-8"
            style={{ color: GOLD, fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}
          >
            Welcome back.
          </h1>
          {errorAlert}
          <div className="mb-6">{form}</div>
          {switchMode}
        </div>
      </div>
    );
  }

  /*
   * The Reddit ad landing (Salomeh's Oct 2026 redesign). Kept on `/` rather
   * than a second route: this has to stay the one place a signup can happen,
   * or the signup handler, the already-registered case and the conversion
   * pixel would all have to be duplicated.
   *
   * Why it changed: 92 of 115 ad clicks reached the old screen and 1 signed
   * up. The ad's button says "Learn more" and the old screen asked for a
   * password after three sentences. This one shows the product, how it works
   * and the price before asking for anything, and its headline matches the
   * best-performing ad ("Most people quit on day 4").
   */
  return (
    <main className="min-h-screen px-5 pb-10 pt-7" style={{ backgroundColor: '#FAF8F5', color: INK }}>
      <div className="mx-auto w-full max-w-sm">
        <AlyneWordmark className="w-24 mx-auto" />

        <div className="mt-7 text-center">
          <h1
            style={{ color: GOLD, fontSize: '1.875rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}
          >
            Most people quit on
            <br />
            day 4.
          </h1>
          <p className="mx-auto mt-3 max-w-xs" style={{ lineHeight: 1.5 }}>
            Not because it got hard. Because nobody noticed.
          </p>
          <p className="mt-3" style={{ color: MUTED, lineHeight: 1.5 }}>
            Alyne pairs you with one real person chasing the same goal, so someone does.
          </p>
        </div>

        <div className="mt-5">
          <PartnerPreview />
        </div>

        <button
          type="button"
          onClick={() => signupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          className="mt-5 w-full transition-all duration-200 active:scale-[0.98]"
          style={ctaStyle}
        >
          Find my partner
        </button>
        <p className="mt-3 text-center text-[0.8rem]" style={{ color: MUTED }}>
          Free to start · No card needed
        </p>

        <section className="mt-5 px-5 py-6" style={cardStyle}>
          <p className="text-[0.75rem] uppercase" style={{ color: MUTED, fontWeight: 600, letterSpacing: '0.1em' }}>
            How it works
          </p>
          <div className="mt-5 space-y-5">
            {HOW_IT_WORKS.map(({ icon: Icon, title, description }) => (
              <div className="flex gap-3.5" key={title}>
                <div
                  className="flex shrink-0 items-center justify-center rounded-full"
                  style={{ width: 40, height: 40, backgroundColor: ICON_SURFACE }}
                >
                  <Icon aria-hidden="true" size={20} strokeWidth={1.5} color={GOLD} />
                </div>
                <div className="pt-0.5">
                  <p style={{ fontWeight: 600, lineHeight: 1.25 }}>{title}</p>
                  <p className="mt-0.5 text-[0.875rem]" style={{ color: MUTED, lineHeight: 1.45 }}>
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section ref={signupRef} className="mt-5 px-5 py-6" style={cardStyle}>
          <h2 className="text-center mb-5" style={{ color: '#1A3328', fontSize: '1.25rem', fontWeight: 600 }}>
            Find your partner
          </h2>
          {errorAlert}
          {form}
          <p className="mx-auto mt-4 max-w-xs text-center text-[0.8rem]" style={{ color: MUTED, lineHeight: 1.5 }}>
            Free to start. Plus is $9.99/month if you want more, with a 7-day free trial.
          </p>
        </section>

        <div className="mt-5">{switchMode}</div>
      </div>
    </main>
  );
}
