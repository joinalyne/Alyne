import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AlyneIcon } from './AlyneIcon';

// Install banner — appears only when the browser fires `beforeinstallprompt`
// (Chrome/Edge/Android). iOS Safari has no install prompt API; users add to
// home screen via Share → "Add to Home Screen", so this stays hidden there.

const CARD_SHADOW = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.07)';
const DISMISS_KEY = 'alyne-install-dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function InstallBanner() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      if (localStorage.getItem(DISMISS_KEY)) return;
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!promptEvent) return null;

  const install = async () => {
    await promptEvent.prompt();
    setPromptEvent(null);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setPromptEvent(null);
  };

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-[1.25rem] p-4"
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
          Add Alyne to your home screen
        </p>
        <p className="text-[0.8rem]" style={{ color: '#8A8580' }}>
          Check in faster — no browser needed.
        </p>
      </div>
      <button
        onClick={install}
        className="shrink-0 rounded-full px-4 py-2 text-[0.85rem]"
        style={{
          background: '#104241',
          color: '#FFFFFF',
          fontWeight: 700,
          boxShadow: '0 4px 20px rgba(16,66,65,0.25)',
        }}
      >
        Install
      </button>
      <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 p-1">
        <X size={18} strokeWidth={1.5} color="#8A8580" />
      </button>
    </div>
  );
}
