import { AlyneWordmark } from '../components/AlyneWordmark';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { supabase, ensureProfile } from '../lib/supabase';

const inputStyle = {
  borderColor: 'rgba(43, 43, 43, 0.1)',
  color: '#2b2b2b',
  backgroundColor: '#FFFFFF',
  boxShadow: '0 2px 12px rgba(43, 43, 43, 0.03)',
};

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
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">

        {/* Logo */}
        <div className="text-center">
          <AlyneWordmark className="w-24 mx-auto mb-6" />
          <h1
            className="text-[1.1rem] tracking-tight"
            style={{ color: '#a8893f' }}
          >
            {isSignUp ? 'Your journey starts here.' : 'Welcome back.'}
          </h1>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-[1.25rem] px-5 py-3 text-center text-[0.9rem]"
            style={{ backgroundColor: '#fdf2f2', color: '#9b2c2c' }}
          >
            {error}
          </p>
        ) : null}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              autoComplete="email"
              className="w-full px-6 py-4 rounded-[1.25rem] border-2 text-[1rem] transition-all duration-200 focus:outline-none"
              style={inputStyle}
            />
          </div>

          {/* Password Input */}
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              className="w-full px-6 py-4 rounded-[1.25rem] border-2 text-[1rem] transition-all duration-200 focus:outline-none"
              style={inputStyle}
            />
          </div>

          {/* Forgot password (log-in mode only) */}
          {!isSignUp && (
            <div className="text-right px-2">
              <Link
                to="/reset-password"
                className="text-[0.875rem]"
                style={{ fontWeight: 600, color: '#a8893f' }}
              >
                Forgot password?
              </Link>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[1.25rem] py-4 transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
            style={{
              backgroundColor: '#104241',
              color: '#FFFFFF',
              fontSize: '1.05rem',
              fontWeight: 700,
              boxShadow: '0 4px 20px rgba(16, 66, 65, 0.25)',
              marginTop: '2rem'
            }}
          >
            {loading ? 'One moment…' : isSignUp ? 'Get Started' : 'Log In'}
          </button>
        </form>

        {/* Toggle Link */}
        <div className="text-center pt-4">
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
            className="text-[0.95rem] transition-opacity hover:opacity-100"
            style={{ color: '#8A8580' }}
          >
            {isSignUp ? (
              <>Already have an account? <span style={{ fontWeight: 600, color: '#a8893f' }}>Log in</span></>
            ) : (
              <>Don't have an account? <span style={{ fontWeight: 600, color: '#a8893f' }}>Sign up</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
