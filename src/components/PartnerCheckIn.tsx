import { useEffect, useState } from 'react';
import { Mic, Camera, PenLine } from 'lucide-react';
import { signedCheckInUrl, type PartnerSnapshot } from '../lib/supabase';
import { relativeTime } from '../lib/dates';
import { canPlayType } from '../hooks/useVoiceRecorder';

const CARD_SHADOW = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.07)';

type CheckIn = NonNullable<PartnerSnapshot['partnerLatestCheckIn']>;

/** The stored path carries the container in its extension, which is all the
 *  browser needs to say whether it could decode it. */
function guessAudioType(path: string | null): string {
  if (!path) return 'audio/mp4';
  if (path.endsWith('.webm')) return 'audio/webm';
  if (path.endsWith('.ogg')) return 'audio/ogg';
  if (path.endsWith('.aac')) return 'audio/aac';
  return 'audio/mp4';
}

/**
 * The partner's most recent check-in, in full.
 *
 * Home previously showed only "Bo checked in 5 minutes ago". The body, photo
 * and audio were all captured and stored, and nothing ever displayed them, so a
 * voice note went nowhere. Seeing your partner actually show up is the product,
 * not a detail.
 *
 * Media lives in a private bucket, so the stored value is a path and not a URL.
 * It has to be exchanged for a signed URL, which is why this fetches rather
 * than rendering src directly.
 */
export function PartnerCheckIn({
  checkIn,
  partnerName,
}: {
  checkIn: CheckIn;
  partnerName: string;
}) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaFailed, setMediaFailed] = useState(false);

  useEffect(() => {
    if (!checkIn.mediaUrl) return;
    let active = true;
    signedCheckInUrl(checkIn.mediaUrl).then((url) => {
      if (!active) return;
      if (url) setMediaUrl(url);
      else setMediaFailed(true);
    });
    return () => { active = false; };
  }, [checkIn.mediaUrl]);

  // Whether THIS browser can decode it, which is a different question from
  // whether the sender could record it.
  const playable =
    checkIn.type !== 'voice' ||
    canPlayType(guessAudioType(checkIn.mediaUrl));

  const Icon = checkIn.type === 'voice' ? Mic : checkIn.type === 'photo' ? Camera : PenLine;
  const label =
    checkIn.type === 'voice' ? 'Voice note'
    : checkIn.type === 'photo' ? 'Photo'
    : 'Note';

  return (
    <div
      className="mb-6"
      style={{ backgroundColor: '#FFFFFF', borderRadius: '1.25rem', padding: '20px', boxShadow: CARD_SHADOW }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="flex items-center justify-center w-7 h-7 rounded-full"
          style={{ backgroundColor: '#f5f3f0' }}
        >
          <Icon size={13} color="#A8893F" strokeWidth={1.5} />
        </div>
        <p className="text-[0.8rem]" style={{ color: '#8A8580' }}>
          {partnerName}&apos;s {label.toLowerCase()} · {relativeTime(checkIn.createdAt)}
        </p>
      </div>

      {checkIn.type === 'photo' && mediaUrl ? (
        <img
          src={mediaUrl}
          alt={`${partnerName}'s check-in`}
          className="w-full rounded-[1rem] object-cover mb-3"
          style={{ maxHeight: '260px' }}
        />
      ) : null}

      {checkIn.type === 'voice' && mediaUrl ? (
        playable ? (
          <audio controls src={mediaUrl} className="w-full mb-3" />
        ) : (
          /* Say so rather than render a player that produces silence. Salomeh
             and Kane hit exactly this: a WebM note recorded in Chrome cannot be
             decoded by Safari, so the controls appeared and nothing happened.
             Older notes may still be in a format this browser cannot play. */
          <p className="text-[0.85rem] mb-3" style={{ color: 'var(--destructive)' }}>
            This voice note was recorded in a format this browser cannot play.
            Try opening Alyne in Chrome, or ask them to record a new one.
          </p>
        )
      ) : null}

      {/* Say so rather than showing an empty card. A partner who recorded
          something should not look like they checked in blank. */}
      {checkIn.mediaUrl && !mediaUrl ? (
        <p className="text-[0.85rem] mb-3" style={{ color: '#8A8580' }}>
          {mediaFailed ? 'That attachment could not be loaded.' : 'Loading…'}
        </p>
      ) : null}

      {checkIn.body ? (
        <p className="text-[0.95rem] leading-relaxed" style={{ color: '#2B2B2B' }}>
          {checkIn.body}
        </p>
      ) : null}

      {/* A photo or voice note with no caption is normal, and needs no filler. */}
      {!checkIn.body && !checkIn.mediaUrl ? (
        <p className="text-[0.9rem]" style={{ color: '#8A8580' }}>
          They checked in.
        </p>
      ) : null}
    </div>
  );
}
