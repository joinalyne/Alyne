import { Mail } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router'
import { ImageWithFallback } from '../components/alyne/ImageWithFallback'
import { supabase } from '../lib/supabase'

export default function CheckEmail() {
  const location = useLocation()
  const email = (location.state as { email?: string } | null)?.email ?? ''
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleResend() {
    if (!email) return
    setError(null)
    setResending(true)
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
      })
      if (resendError) throw resendError
      setResent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend. Please try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 py-6">
      <div className="w-full max-w-md text-center">
        <ImageWithFallback
          src="/alyne-logo.png"
          alt="alyne"
          className="mx-auto mb-10 w-32"
        />

        <div
          className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: '#f5f3f0' }}
        >
          <Mail size={28} color="#a8893f" strokeWidth={1.5} />
        </div>

        <h1
          className="text-[1.5rem] font-semibold tracking-tight"
          style={{ color: '#1A3328' }}
        >
          Check your email.
        </h1>

        <p className="mt-3 px-2 text-[0.95rem] leading-relaxed text-[#2b2b2b]/70">
          We sent a confirmation link to{' '}
          <span className="font-medium" style={{ color: '#1A3328' }}>
            {email || 'your email'}
          </span>
          . Click it to activate your account.
        </p>

        <p className="mt-8 text-[0.8rem] text-[#2b2b2b]/50">
          Didn&apos;t get it? Check your spam or resend below.
        </p>

        <div className="mt-2">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || resent || !email}
            className="text-[0.95rem] font-semibold disabled:opacity-60"
            style={{ color: '#B8860B' }}
          >
            {resending
              ? 'Resending…'
              : resent
                ? 'Sent — check again'
                : 'Resend confirmation email'}
          </button>
        </div>

        {error ? (
          <p className="mt-4 text-[0.85rem] text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
