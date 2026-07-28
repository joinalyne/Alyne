import { Camera, Mic, Edit3, ChevronLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getPartnerSnapshot } from '../lib/supabase';

const CARD_SHADOW = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.07)';

export default function CheckIn() {
  const navigate = useNavigate();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  // Real partner, not the mock "Jamie". Saving a check-in is M2 — see
  // handleSend — but showing a signed-in user a stranger's name is not a
  // sensible way to represent "not built yet".
  const [partnerName, setPartnerName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getPartnerSnapshot().then((snapshot) => {
      if (active) setPartnerName(snapshot?.partner.displayName ?? null);
    });
    return () => { active = false; };
  }, []);

  const partner = { name: partnerName ?? 'your partner' };

  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const checkInOptions = [
    { id: 'photo', title: 'Photo',        subtitle: 'Show us where you are', icon: Camera },
    { id: 'voice', title: 'Voice Note',   subtitle: 'Say how it went',        icon: Mic   },
    { id: 'text',  title: 'Quick Update', subtitle: 'A few words is enough',  icon: Edit3 },
  ];

  const handleSend = () => {
    // M2: photo/voice/text check-in backend, one-per-day enforcement and the
    // nightly streak job. The button is disabled until then rather than
    // silently discarding what someone typed.
  };

  return (
    <div className="min-h-screen flex items-start justify-center p-6 bg-background">
      <div className="w-full max-w-md pt-12">

        {/* Top bar */}
        <div className="relative flex items-center justify-center mb-8">
          <button
            onClick={() => navigate(-1)}
            className="absolute left-0 flex items-center justify-center w-10 h-10"
          >
            <ChevronLeft size={24} strokeWidth={1.5} color="#2B2B2B" />
          </button>
          <div className="text-center">
            <h1 className="text-[1.45rem] tracking-tight" style={{ color: '#2B2B2B', fontWeight: 600 }}>
              Today's Check-In
            </h1>
            <p className="text-[0.85rem] mt-1" style={{ color: '#8A8580' }}>
              {dateString}
            </p>
          </div>
        </div>

        {/* Check-in cards */}
        <div className="space-y-3">
          {checkInOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedOption === option.id;

            return (
              <button
                key={option.id}
                onClick={() => setSelectedOption(isSelected ? null : option.id)}
                className="w-full text-left transition-all duration-200 active:scale-[0.98]"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '1.25rem',
                  padding: '20px',
                  boxShadow: CARD_SHADOW,
                  border: isSelected ? '1.5px solid #1A3328' : '1.5px solid transparent',
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="flex items-center justify-center w-12 h-12 rounded-full flex-shrink-0"
                    style={{ backgroundColor: '#F5F3F0' }}
                  >
                    <Icon size={22} color="#A8893F" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p style={{ color: '#2B2B2B', fontWeight: 600, fontSize: '1rem' }}>
                      {option.title}
                    </p>
                    <p style={{ color: '#8A8580', fontSize: '0.875rem', marginTop: '2px' }}>
                      {option.subtitle}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Text input — expands when Quick Update selected */}
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            maxHeight: selectedOption === 'text' ? '180px' : '0',
            opacity: selectedOption === 'text' ? 1 : 0,
            marginTop: selectedOption === 'text' ? '12px' : '0',
          }}
        >
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="How did it go today?"
            rows={4}
            className="w-full resize-none focus:outline-none"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '1.25rem',
              padding: '18px 20px',
              border: '1.5px solid rgba(43,43,43,0.1)',
              boxShadow: '0 2px 12px rgba(43,43,43,0.03)',
              color: '#2B2B2B',
              fontSize: '0.95rem',
            }}
          />
        </div>

        {/* Send button */}
        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={handleSend}
            disabled
            title="Saving check-ins arrives in the next milestone"
            className="w-full transition-all duration-200 disabled:opacity-50"
            style={{
              backgroundColor: '#104241',
              color: '#FFFFFF',
              borderRadius: '1.25rem',
              padding: '18px',
              fontSize: '1.05rem',
              fontWeight: 700,
              boxShadow: '0 4px 20px rgba(16,66,65,0.25)',
            }}
          >
            Send to {partner.name}
          </button>
          <p className="text-center text-[0.85rem]" style={{ color: '#8A8580' }}>
            {partner.name} will be notified when you check in.
          </p>
        </div>

      </div>
    </div>
  );
}
