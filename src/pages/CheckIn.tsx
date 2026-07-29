import { Camera, Mic, Edit3, ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { getPartnerSnapshot, saveCheckIn, type CheckInType } from '../lib/supabase';
import { useVoiceRecorder, formatDuration, MAX_RECORDING_MS } from '../hooks/useVoiceRecorder';
import { shouldOfferPush, enablePush, markAsked } from '../lib/push';
import { useAuth } from '../contexts/useAuth';

const CARD_SHADOW = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.07)';

export default function CheckIn() {
  const navigate = useNavigate();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { refreshProfile } = useAuth();
  const voice = useVoiceRecorder();
  // Her spec: ask about notifications AFTER a first check-in, never on load,
  // and behind a soft in-app ask so the browser prompt is only reached by
  // someone who has already said yes.
  const [offerPush, setOfferPush] = useState(false);
  const [enabling, setEnabling] = useState(false);

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

  const handleSend = async () => {
    if (!selectedOption) return;
    setError(null);
    setSaving(true);
    try {
      const media =
        selectedOption === 'voice' ? (voice.blob ?? undefined) : (photoFile ?? undefined);

      const result = await saveCheckIn(selectedOption as CheckInType, message, media);

      if (result.ok) {
        // Refresh so Home shows the streak this check-in just advanced.
        await refreshProfile();
        if (shouldOfferPush(true)) {
          setOfferPush(true);
          return;
        }
        navigate('/home', { replace: true });
        return;
      }

      setError(
        result.alreadyToday
          ? "You've already checked in today. Come back tomorrow."
          : result.message,
      );
    } finally {
      setSaving(false);
    }
  };

  const onPhotoPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  // The soft ask. Shown once, in place of returning to Home, so it lands on the
  // one moment the user has just proved they care about the habit.
  if (offerPush) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div
          className="w-full max-w-md p-6 rounded-[1.25rem] text-center"
          style={{ backgroundColor: '#FFFFFF', boxShadow: CARD_SHADOW }}
        >
          <h2 className="text-[1.25rem] mb-2" style={{ color: '#1A3328', fontWeight: 600 }}>
            Checked in.
          </h2>
          <p className="text-[0.95rem] leading-relaxed mb-6" style={{ color: '#8A8580' }}>
            Want to know the moment {partner.name} checks in?
          </p>
          <div className="space-y-3">
            <button
              type="button"
              disabled={enabling}
              onClick={async () => {
                setEnabling(true);
                // The real browser prompt fires only here, from a gesture.
                await enablePush();
                navigate('/home', { replace: true });
              }}
              className="w-full rounded-[1.25rem] py-4 disabled:opacity-60"
              style={{ backgroundColor: '#104241', color: '#FFFFFF', fontWeight: 700 }}
            >
              {enabling ? 'One moment…' : 'Enable notifications'}
            </button>
            <button
              type="button"
              onClick={() => {
                // Remember the refusal so they are never asked again, per spec.
                markAsked();
                navigate('/home', { replace: true });
              }}
              className="w-full rounded-[1.25rem] py-4"
              style={{
                backgroundColor: '#FFFFFF', color: '#2B2B2B', fontWeight: 600,
                border: '1.5px solid rgba(43,43,43,0.15)',
              }}
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    );
  }

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
                type="button"
                onClick={() => {
                  const next = isSelected ? null : option.id;
                  setSelectedOption(next);
                  setError(null);
                  // Switching away from voice must release the microphone, not
                  // just hide the controls.
                  if (next !== 'voice') voice.reset();
                  if (next === 'photo') photoInputRef.current?.click();
                }}
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

        {/* Hidden picker — opened by choosing the Photo card. */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPhotoPicked}
        />

        {selectedOption === 'voice' ? (
          <div
            className="mt-5 p-5 rounded-[1.25rem] text-center"
            style={{ backgroundColor: '#FFFFFF', boxShadow: CARD_SHADOW }}
          >
            {voice.state === 'unsupported' ? (
              <p className="text-[0.9rem]" style={{ color: '#8A8580' }}>
                This browser cannot record audio. Try a photo or a written note instead.
              </p>
            ) : voice.state === 'denied' ? (
              <p className="text-[0.9rem]" style={{ color: '#9b2c2c' }}>
                Microphone access was blocked. You can allow it in your browser settings,
                or check in with a photo or a note instead.
              </p>
            ) : voice.state === 'recording' ? (
              <>
                <p className="text-[1.4rem] tabular-nums" style={{ color: '#104241', fontWeight: 700 }}>
                  {formatDuration(voice.elapsedMs)}
                </p>
                <p className="text-[0.78rem] mb-4" style={{ color: '#8A8580' }}>
                  Recording, up to {formatDuration(MAX_RECORDING_MS)}
                </p>
                <button
                  type="button"
                  onClick={voice.stop}
                  className="w-full rounded-[1.25rem] py-3"
                  style={{ backgroundColor: '#104241', color: '#FFFFFF', fontWeight: 700 }}
                >
                  Stop recording
                </button>
              </>
            ) : voice.state === 'recorded' && voice.previewUrl ? (
              <>
                <p className="text-[0.78rem] mb-3" style={{ color: '#8A8580' }}>
                  {formatDuration(voice.elapsedMs)} recorded. Have a listen before you send.
                </p>
                {/* Playback before sending, because a voice note is the one
                    check-in you cannot proofread. */}
                <audio controls src={voice.previewUrl} className="w-full mb-3" />
                <button
                  type="button"
                  onClick={voice.reset}
                  className="w-full rounded-[1.25rem] py-3"
                  style={{
                    backgroundColor: '#FFFFFF', color: '#2B2B2B', fontWeight: 600,
                    border: '1.5px solid rgba(43,43,43,0.15)',
                  }}
                >
                  Record again
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void voice.start()}
                disabled={voice.state === 'requesting'}
                className="w-full rounded-[1.25rem] py-3 disabled:opacity-60"
                style={{ backgroundColor: '#104241', color: '#FFFFFF', fontWeight: 700 }}
              >
                {voice.state === 'requesting' ? 'Waiting for microphone…' : 'Start recording'}
              </button>
            )}
          </div>
        ) : null}

        {photoPreview ? (
          <div className="mt-5">
            <img
              src={photoPreview}
              alt="Your check-in photo"
              className="w-full rounded-[1.25rem] object-cover"
              style={{ maxHeight: '240px', boxShadow: CARD_SHADOW }}
            />
          </div>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-[1.25rem] px-5 py-3 text-center text-[0.9rem]"
            style={{ backgroundColor: '#fdf2f2', color: '#9b2c2c' }}
          >
            {error}
          </p>
        ) : null}

        {/* Send button */}
        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={
              saving ||
              !selectedOption ||
              (selectedOption === 'voice' && !voice.blob) ||
              (selectedOption === 'photo' && !photoFile)
            }
            title={
              !selectedOption
                ? 'Choose how you want to check in'
                : selectedOption === 'voice' && !voice.blob
                  ? 'Record a note first'
                  : selectedOption === 'photo' && !photoFile
                    ? 'Choose a photo first'
                    : undefined
            }
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
            {saving ? 'Sending…' : `Send to ${partner.name}`}
          </button>
          <p className="text-center text-[0.85rem]" style={{ color: '#8A8580' }}>
            {partner.name} will be notified when you check in.
          </p>
        </div>

      </div>
    </div>
  );
}
