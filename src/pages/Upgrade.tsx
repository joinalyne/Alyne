import { useState } from 'react';
import { ChevronLeft, Zap, Target, SlidersHorizontal, Map, Check } from 'lucide-react';
import { Link } from 'react-router';

// ─────────────────────────────────────────────────────────────────────────────
// UPGRADE — the paywall screen. Design-complete; Jerome wires the money.
//
// Pricing (locked): $9.99/mo · $79.99/yr (~33% off) · 7-day free trial.
// Launch paid feature: priority rematch. Other benefits shown as "coming soon".
//
// TODO(Jerome): "Start Free Trial" → create Stripe Checkout Session with the
//   selected price ID and trial_period_days: 7, then redirect to session.url.
// TODO(Jerome): if profiles.plan === 'paid', route users away from this screen
//   (or swap CTA for a Customer Portal link).
// ─────────────────────────────────────────────────────────────────────────────

const CARD_SHADOW = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.07)';

const COMING_SOON = [
  { icon: Target, title: 'Multiple goals' },
  { icon: SlidersHorizontal, title: 'Matching filters' },
  { icon: Map, title: 'Guided programs' },
];

export default function Upgrade() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');

  const startTrial = () => {
    // TODO(Jerome): POST to the checkout-session endpoint with the price ID
    // for `billing`, trial_period_days: 7 — then window.location = session.url
    console.log('start trial:', billing);
  };

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="max-w-md mx-auto">

        {/* Top bar */}
        <div className="relative flex items-center justify-center mb-8">
          {/* replace, not push: without it the stack grows a second Settings entry and
              Settings' own back button walks forward into this screen again. */}
          <Link to="/settings" replace className="absolute left-0 top-1/2 -translate-y-1/2 flex">
            <ChevronLeft size={24} strokeWidth={1.5} color="#2B2B2B" />
          </Link>
          <span style={{ color: '#2B2B2B', fontWeight: 600, fontSize: '1.1rem' }}>Upgrade</span>
        </div>

        {/* Headline */}
        <div className="text-center mb-8">
          <h1 className="text-[1.45rem] tracking-tight mb-2" style={{ color: '#A8893F', fontWeight: 600 }}>
            Go further, together.
          </h1>
          <p className="text-[0.95rem]" style={{ color: '#8A8580' }}>
            Try everything free for 7 days.
          </p>
        </div>

        {/* Billing toggle */}
        <div
          className="flex rounded-[1.25rem] p-1 mb-6"
          style={{ background: '#FFFFFF', boxShadow: CARD_SHADOW }}
        >
          {(['monthly', 'annual'] as const).map((b) => {
            const active = billing === b;
            return (
              <button
                key={b}
                onClick={() => setBilling(b)}
                className="flex-1 rounded-[1rem] py-3 text-[0.9rem] transition-all duration-200"
                style={{
                  background: active ? '#104241' : 'transparent',
                  color: active ? '#FFFFFF' : '#8A8580',
                  fontWeight: 600,
                }}
              >
                {b === 'monthly' ? '$9.99 / month' : '$79.99 / year'}
              </button>
            );
          })}
        </div>
        {billing === 'annual' && (
          <p className="text-center text-[0.85rem] -mt-3 mb-6" style={{ color: '#A8893F', fontWeight: 600 }}>
            Two months free vs. monthly
          </p>
        )}

        {/* Live benefit */}
        <div className="rounded-[1.25rem] p-5 mb-3" style={{ background: '#FFFFFF', boxShadow: CARD_SHADOW }}>
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full shrink-0" style={{ background: '#F5F3F0' }}>
              <Zap size={22} color="#A8893F" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[1rem] mb-1" style={{ color: '#2B2B2B', fontWeight: 600 }}>Priority rematch</p>
              <p className="text-[0.875rem] leading-relaxed" style={{ color: '#8A8580' }}>
                If a partner goes quiet, skip the queue and get re-paired first.
              </p>
            </div>
          </div>
        </div>

        {/* Coming soon */}
        <div className="rounded-[1.25rem] p-5 mb-8" style={{ background: '#FFFFFF', boxShadow: CARD_SHADOW }}>
          <p
            className="text-[0.75rem] uppercase mb-4"
            style={{ color: '#8A8580', fontWeight: 600, letterSpacing: '0.07em' }}
          >
            Coming to your plan
          </p>
          <div className="space-y-3">
            {COMING_SOON.map(({ icon: Icon, title }) => (
              <div key={title} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full shrink-0" style={{ background: '#F5F3F0' }}>
                  <Icon size={15} color="#A8893F" strokeWidth={1.5} />
                </div>
                <p className="text-[0.9rem]" style={{ color: '#2B2B2B', fontWeight: 500 }}>{title}</p>
                <Check size={14} color="#A8893F" strokeWidth={2} className="ml-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={startTrial}
          className="w-full rounded-[1.25rem] py-[18px] transition-all duration-200 active:scale-[0.98]"
          style={{
            background: '#104241',
            color: '#FFFFFF',
            fontSize: '1.05rem',
            fontWeight: 700,
            boxShadow: '0 4px 20px rgba(16,66,65,0.25)',
          }}
        >
          Start Free Trial
        </button>
        <p className="text-center text-[0.8rem] mt-3" style={{ color: '#8A8580' }}>
          Free for 7 days, then {billing === 'monthly' ? '$9.99/month' : '$79.99/year'}. Cancel anytime.
        </p>

      </div>
    </div>
  );
}
