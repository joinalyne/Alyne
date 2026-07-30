import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatDuration, extensionFor, MAX_RECORDING_MS } from './useVoiceRecorder';
import { extensionForMimeType } from '../lib/supabase';

describe('formatDuration', () => {
  it('reads m:ss with a padded seconds field', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5_000)).toBe('0:05');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(600_000)).toBe('10:00');
  });

  it('truncates rather than rounds up, so the timer never overstates', () => {
    expect(formatDuration(1_999)).toBe('0:01');
  });

  it('renders the recording cap sensibly', () => {
    expect(formatDuration(MAX_RECORDING_MS)).toBe('2:00');
  });
});

describe('audio container handling', () => {
  it('maps webm, which Chrome and Firefox produce', () => {
    expect(extensionFor('audio/webm;codecs=opus')).toBe('webm');
  });

  it('maps mp4, which Safari produces instead', () => {
    // Safari's MediaRecorder cannot make webm. Assuming it could would store
    // iPhone recordings under a filename that misdescribes them.
    expect(extensionFor('audio/mp4')).toBe('m4a');
  });

  it('falls back to webm for anything unrecognised', () => {
    expect(extensionFor('audio/something-new')).toBe('webm');
  });
});

describe('extensionForMimeType', () => {
  it('agrees with the recorder about audio containers', () => {
    for (const type of ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus']) {
      expect(extensionForMimeType(type, 'voice')).toBe(extensionFor(type));
    }
  });

  it('handles image types for photo check-ins', () => {
    expect(extensionForMimeType('image/jpeg', 'photo')).toBe('jpg');
    expect(extensionForMimeType('image/png', 'photo')).toBe('png');
    // iPhones hand over HEIC unless the picker converts it.
    expect(extensionForMimeType('image/heic', 'photo')).toBe('heic');
  });

  it('is case-insensitive, since MIME types arrive inconsistently cased', () => {
    expect(extensionForMimeType('AUDIO/WEBM', 'voice')).toBe('webm');
  });

  it('falls back by kind rather than to a meaningless .bin', () => {
    expect(extensionForMimeType('', 'voice')).toBe('webm');
    expect(extensionForMimeType('', 'photo')).toBe('jpg');
  });
});

describe('cross-browser playability', () => {
  it('prefers a format the OTHER person can play, not just one we can record', () => {
    // The bug Salomeh and Kane hit: notes recorded fine and were silent for each
    // other, because Safari cannot decode WebM audio. Preferring WebM solved the
    // recording problem and created a playback one.
    const order = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/aac'];
    const source = readFileSync(join(process.cwd(), 'src', 'hooks', 'useVoiceRecorder.ts'), 'utf8');
    const list = source.slice(
      source.indexOf('const CANDIDATE_TYPES'),
      source.indexOf('];', source.indexOf('const CANDIDATE_TYPES')),
    );
    const mp4At = list.indexOf('audio/mp4');
    const webmAt = list.indexOf('audio/webm');
    expect(mp4At).toBeGreaterThan(-1);
    expect(webmAt).toBeGreaterThan(-1);
    expect(mp4At).toBeLessThan(webmAt);
    for (const t of order) expect(list).toContain(t);
  });

  it('still maps every container to a sensible extension', () => {
    expect(extensionFor('audio/mp4')).toBe('m4a');
    expect(extensionFor('audio/mp4;codecs=mp4a.40.2')).toBe('m4a');
    expect(extensionFor('audio/aac')).toBe('aac');
    expect(extensionFor('audio/webm;codecs=opus')).toBe('webm');
  });
});
