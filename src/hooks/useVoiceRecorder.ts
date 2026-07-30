import { useCallback, useEffect, useRef, useState } from 'react';

/** Cap a note so an accidental long recording cannot produce a huge upload. */
export const MAX_RECORDING_MS = 120_000;

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'recorded' | 'denied' | 'unsupported';

/**
 * Candidate container formats, in preference order. MP4 FIRST, deliberately.
 *
 * The original order preferred webm because that is what Chrome and Firefox
 * record natively. That was solving the wrong half of the problem. Salomeh and
 * Kane recorded voice notes that saved correctly and then could not play each
 * other's: Safari cannot decode WebM audio at all, so a note recorded in Chrome
 * is silent on an iPhone. In a two-person app the format has to be one the
 * OTHER person can play, not merely one this browser can record.
 *
 * MP4/AAC plays everywhere. Chrome and Safari can both record it, so preferring
 * it means most pairs exchange something universally playable. WebM stays as a
 * fallback for browsers that cannot record MP4, which is better than refusing
 * to record at all, but it is a fallback rather than the default.
 */
const CANDIDATE_TYPES = [
  'audio/mp4',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/aac',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
];

/** True when the browser can PLAY this, which is a different question from
 *  whether it can record it. Used to warn rather than fail silently. */
export function canPlayType(mimeType: string): boolean {
  if (typeof document === 'undefined') return true;
  const audio = document.createElement('audio');
  // canPlayType returns '', 'maybe' or 'probably'. Empty means definitely not.
  return audio.canPlayType(mimeType.split(';')[0]) !== '';
}

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const type of CANDIDATE_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  // An empty string is valid: it tells MediaRecorder to choose for itself.
  return '';
}

export function extensionFor(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('aac')) return 'aac';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

export function useVoiceRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);

  /**
   * Release the microphone. Without this the browser keeps showing a recording
   * indicator after the user has finished, which reads as the app listening in.
   */
  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    const mimeType = pickMimeType();
    if (mimeType === null || !navigator.mediaDevices?.getUserMedia) {
      setState('unsupported');
      return;
    }

    setState('requesting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Covers an outright block and a dismissed prompt alike. Either way the
      // answer to the user is the same, so they are not told to "try again" on
      // a permission they have actually refused.
      setState('denied');
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const type = recorder.mimeType || mimeType || 'audio/webm';
      const recorded = new Blob(chunksRef.current, { type });
      setBlob(recorded);

      // Revoke the previous URL before replacing it, or re-recording leaks one
      // object URL per attempt.
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const url = URL.createObjectURL(recorded);
      previewUrlRef.current = url;
      setPreviewUrl(url);

      setState('recorded');
      releaseStream();
    };

    startedAtRef.current = Date.now();
    setElapsedMs(0);
    recorder.start();
    setState('recording');

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      setElapsedMs(elapsed);
      if (elapsed >= MAX_RECORDING_MS) stop();
    }, 200);
  }, [releaseStream, stop]);

  const reset = useCallback(() => {
    stop();
    releaseStream();
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setBlob(null);
    setPreviewUrl(null);
    setElapsedMs(0);
    setState('idle');
  }, [releaseStream, stop]);

  // Leaving the screen mid-recording must not leave the microphone open.
  useEffect(() => () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  return { state, blob, previewUrl, elapsedMs, start, stop, reset };
}

/** m:ss for the recording timer. */
export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
