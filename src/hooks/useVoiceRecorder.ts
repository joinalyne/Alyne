import { useCallback, useEffect, useRef, useState } from 'react';

/** Cap a note so an accidental long recording cannot produce a huge upload. */
export const MAX_RECORDING_MS = 120_000;

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'recorded' | 'denied' | 'unsupported';

/**
 * Candidate container formats, in preference order.
 *
 * Chrome and Firefox produce webm/opus; Safari cannot, and produces mp4/aac
 * instead. Hardcoding webm would make voice notes silently fail on iPhone,
 * which is the platform this app is mostly used on, so the format is negotiated
 * rather than assumed.
 */
const CANDIDATE_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/ogg;codecs=opus',
];

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
