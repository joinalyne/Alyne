import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Mail, KeyRound } from 'lucide-react';
import { AlyneWordmark } from '../components/AlyneWordmark';
import { requestPasswordReset, updatePassword } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Reset password — two halves of one flow:
//   1) "request": user enters their email → Supabase sends a reset link
//   2) "recovery": user arrives back here FROM that email link (Supabase puts
//      type=recovery in the URL hash) → they choose a new password
// Styling mirrors Auth.tsx exactly (input + CTA standards from the handoff).
// ─────────────────────────────────────────────────────────────────────────────

const inputStyle = {
  borderColor: 'rgba(43, 43, 43, 0.1)',
  color: '#2b2b2b',
  backgroundColor: '#FFFFFF',
  boxShadow: '0 2px 12px rgba(43, 43, 43, 0.03)',
} as const;

const ctaStyle = {
  backgroundColor: '#104241',
  color: '#FFFFFF',
  fontSize: '1.05rem',
  fontWeight: 700,
  boxShadow: '0 4px 20px rgba(16, 66, 65, 0.25)',
  marginTop: '2rem',
} as const;

type Stage = 'request' | 'sent' | 'recovery' | 'done';

export default function ResetPassword() {
  const [stage, setStage] = useState<Stage>('request');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // Arriving from the reset email? Supabase appends type=recovery to the hash.
  useEffect(() => {
    if (window.location.hash.includes('type=recovery')) setStage('recovery');
  }, []);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await requestPasswordReset(email.trim());
    setBusy(false);
    if (ok) setStage('sent');
  };

  const saveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await updatePassword(newPassword);
    setBusy(false);
    if (ok) setStage('done');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">

        {/* Logo + subtitle */}
        <div className="text-center">
          <AlyneWordmark className="w-24 mx-auto mb-6" />
          <h1 className="text-[1.1rem] tracking-tight" style={{ color: '#a8893f' }}>
            {stage === 'request' && "Let's get you back in."}
            {stage === 'sent' && 'Check your email.'}
            {stage === 'recovery' && 'Choose a new password.'}
            {stage === 'done' && "You're all set."}
          </h1>
        </div>

        {/* 1 — request the link */}
        {stage === 'request' && (
          <>
            <form onSubmit={sendLink} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                className="w-full px-6 py-4 rounded-[1.25rem] border-2 text-[1rem] transition-all duration-200 focus:outline-none"
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-[1.25rem] py-4 transition-all duration-200 active:scale-[0.98]"
                style={ctaStyle}
              >
                {busy ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
            <p className="text-center text-[0.9rem]" style={{ color: '#8A8580' }}>
              We'll email you a link to reset your password.
            </p>
          </>
        )}

        {/* 2 — link sent */}
        {stage === 'sent' && (
          <div className="text-center space-y-4">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: '#F5F3F0' }}
            >
              <Mail size={24} color="#A8893F" strokeWidth={1.5} />
            </div>
            <p className="text-[0.95rem] leading-relaxed" style={{ color: '#2B2B2B' }}>
              If an account exists for <span style={{ fontWeight: 600 }}>{email}</span>,
              a reset link is on its way.
            </p>
            <p className="text-[0.85rem]" style={{ color: '#8A8580' }}>
              Didn't get it? Check spam, or{' '}
              <button
                onClick={() => setStage('request')}
                style={{ fontWeight: 600, color: '#a8893f' }}
              >
                try again
              </button>.
            </p>
          </div>
        )}

        {/* 3 — arrived from the email: set a new password */}
        {stage === 'recovery' && (
          <form onSubmit={saveNewPassword} className="space-y-4">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              required
              minLength={8}
              className="w-full px-6 py-4 rounded-[1.25rem] border-2 text-[1rem] transition-all duration-200 focus:outline-none"
              style={inputStyle}
            />
            <p className="text-[0.85rem] px-2" style={{ color: '#8A8580' }}>
              At least 8 characters.
            </p>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-[1.25rem] py-4 transition-all duration-200 active:scale-[0.98]"
              style={ctaStyle}
            >
              {busy ? 'Saving…' : 'Save New Password'}
            </button>
          </form>
        )}

        {/* 4 — done */}
        {stage === 'done' && (
          <div className="text-center space-y-4">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: '#F5F3F0' }}
            >
              <KeyRound size={24} color="#A8893F" strokeWidth={1.5} />
            </div>
            <p className="text-[0.95rem]" style={{ color: '#2B2B2B' }}>
              Your password has been updated.
            </p>
            <Link
              to="/"
              className="inline-block w-full rounded-[1.25rem] py-4 text-center transition-all duration-200 active:scale-[0.98]"
              style={ctaStyle}
            >
              Log In
            </Link>
          </div>
        )}

        {/* Back to log in */}
        {(stage === 'request' || stage === 'sent') && (
          <div className="text-center pt-4">
            <Link
              to="/"
              className="text-[0.95rem] transition-opacity hover:opacity-100"
              style={{ color: '#8A8580' }}
            >
              Remembered it? <span style={{ fontWeight: 600, color: '#a8893f' }}>Log in</span>
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
