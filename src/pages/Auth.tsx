import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ImageWithFallback } from '../components/alyne/ImageWithFallback'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isSignUp, setIsSignUp] = useState(location.pathname !== '/auth')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const trimmedEmail = email.trim()

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: 'https://alyne-git-main-alyne-s-projects.vercel.app/auth',
          },
        })

        if (signUpError) throw signUpError

        if (data.session) {
          void navigate('/profile-setup')
          return
        }

        void navigate('/check-email', { state: { email: trimmedEmail } })
        return
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) throw signInError

      if (data.session) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('user_id', data.session.user.id)
          .maybeSingle()

        if (profileError) throw profileError

        void navigate(profile ? '/home' : '/profile-setup')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 py-6">
      <div className="w-full max-w-md">
        <div className="text-center">
          <ImageWithFallback src="/alyne-logo.png" alt="alyne" className="mx-auto mb-3 w-32" />
          <p className="text-[1rem]" style={{ color: '#B8860B' }}>
            {isSignUp ? 'Your journey starts here.' : 'Welcome back.'}
          </p>
        </div>

        {error ? (
          <p
            className="mt-4 rounded-2xl bg-red-50 px-4 py-2.5 text-center text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-8 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            required
            autoComplete="email"
            disabled={loading}
            className="w-full rounded-full bg-white px-6 py-4 text-[1rem] placeholder:text-[#9a9a96] focus:outline-none disabled:opacity-60"
            style={{ color: '#1D3D38', boxShadow: '0 1px 2px rgba(29, 61, 56, 0.04)' }}
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            minLength={6}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            disabled={loading}
            className="w-full rounded-full bg-white px-6 py-4 text-[1rem] placeholder:text-[#9a9a96] focus:outline-none disabled:opacity-60"
            style={{ color: '#1D3D38', boxShadow: '0 1px 2px rgba(29, 61, 56, 0.04)' }}
          />

          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full rounded-full py-4 text-[1.05rem] font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            style={{ backgroundColor: '#1D3D38', boxShadow: '0 4px 16px rgba(29, 61, 56, 0.18)' }}
          >
            {loading ? 'Please wait…' : isSignUp ? 'Get Started' : 'Log In'}
          </button>
        </form>

        <p className="mt-6 text-center text-[0.9rem]" style={{ color: '#1D3D38' }}>
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <button
            type="button"
            disabled={loading}
            className="font-semibold disabled:opacity-60"
            style={{ color: '#B8860B' }}
            onClick={() => {
              setIsSignUp((v) => !v)
              setError(null)
            }}
          >
            {isSignUp ? 'Log in' : 'Sign up'}
          </button>
        </p>

        <div className="mt-8 text-center">
          <Link to="/home" className="text-[0.9rem]" style={{ color: '#9a9a96' }}>
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
