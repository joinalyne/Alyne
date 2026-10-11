import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { X } from 'lucide-react';
import { AlyneIcon } from './AlyneIcon';
import { pushSupport } from '../lib/push';

/**
 * Install banner, in two flavours.
 *
 * Chrome and Android fire `beforeinstallprompt`, so there the banner can call
 * the real browser prompt. iOS Safari has no such API — the only route is
 * Share → "Add to Home Screen" — and the old banner therefore never appeared
 * there at all. That left iPhone users, who are most of this app's traffic and
 * the only ones who *cannot* get push without installing, with no prompt on any
 * screen they spend time on. The iOS half of this component points at
 * /add-to-home, which already explains the three steps.
 *
 * Shown only on the signed-in screens someone actually dwells on. Deliberately
 * NOT on `/` (paid ad traffic lands there; a banner over the signup form costs
 * signups), nor mid-onboarding, nor on /finding-partner, which already makes
 * this same ask twice in the body of the page.
 */

const CARD_SHADOW = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.07)';
const PROMPT_DISMISS_KEY = 'alyne-install-dismissed';
const IOS_DISMISS_KEY = 'alyne-install-ios-dismissed';

const SHOW_ON = new Set(['/home', '/home-empty', '/matched', '/check-in', '/settings']);

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/** localStorage throws in private browsing; a missing dismissal is harmless. */
function wasDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function rememberDismissal(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Worst case the banner returns next visit.
  }
}

function Shell({
  title,
  subtitle,
  action,
  onDismiss,
}: {
  title: string;
  subtitle: string;
  action: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-[18px] p-4"
      style={{ background: '#FFFFFF', boxShadow: CARD_SHADOW }}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.9rem]"
        style={{ background: '#104241' }}
      >
        <AlyneIcon className="h-6 w-6" color="#FFFFFF" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[0.95rem]" style={{ color: '#2B2B2B', fontWeight: 600 }}>
          {title}
        </p>
        <p className="text-[0.8rem]" style={{ color: '#8A8580' }}>
          {subtitle}
        </p>
      </div>
      {action}
      <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 p-1">
        <X size={18} strokeWidth={1.5} color="#8A8580" />
      </button>
    </div>
  );
}

const pillStyle = {
  background: '#104241',
  color: '#FFFFFF',
  fontWeight: 700,
  boxShadow: '0 4px 20px rgba(16,66,65,0.25)',
} as const;

export function InstallBanner() {
  const { pathname } = useLocation();
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  // Evaluated once: it cannot change without a reload, and reading it in state
  // keeps the first paint from flashing a banner that is about to be hidden.
  const [needsIosInstall] = useState(
    () => pushSupport() === 'needs-install' && !wasDismissed(IOS_DISMISS_KEY),
  );
  const [iosDismissed, setIosDismissed] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      if (wasDismissed(PROMPT_DISMISS_KEY)) return;
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!SHOW_ON.has(pathname)) return null;

  if (promptEvent) {
    return (
      <Shell
        title="Add Alyne to your home screen"
        subtitle="Check in faster — no browser needed."
        onDismiss={() => {
          rememberDismissal(PROMPT_DISMISS_KEY);
          setPromptEvent(null);
        }}
        action={
          <button
            onClick={async () => {
              await promptEvent.prompt();
              setPromptEvent(null);
            }}
            className="shrink-0 rounded-full px-4 py-2 text-[0.85rem]"
            style={pillStyle}
          >
            Install
          </button>
        }
      />
    );
  }

  if (needsIosInstall && !iosDismissed) {
    return (
      <Shell
        title="Add Alyne to your home screen"
        subtitle="On iPhone it's the only way check-in nudges can reach you."
        onDismiss={() => {
          rememberDismissal(IOS_DISMISS_KEY);
          setIosDismissed(true);
        }}
        action={
          <Link
            to="/add-to-home"
            className="shrink-0 rounded-full px-4 py-2 text-[0.85rem]"
            style={{ ...pillStyle, textDecoration: 'none' }}
          >
            Show me
          </Link>
        }
      />
    );
  }

  return null;
}
