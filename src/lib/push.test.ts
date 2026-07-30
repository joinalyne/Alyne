import { describe, it, expect, vi, afterEach } from 'vitest';
import { pushSupport, shouldOfferPush } from './push';

/**
 * The case that matters: an iPhone in Safari. Push is impossible there until the
 * app is on the home screen, and the original code reported that as
 * 'unsupported', which made Settings hide the row entirely. A mobile user never
 * discovered notifications existed, on the platform the app is mostly used on.
 */
function pretendIphoneInSafari() {
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari',
    platform: 'iPhone',
    maxTouchPoints: 5,
    // In a tab, Safari exposes none of these.
  });
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
}

afterEach(() => vi.unstubAllGlobals());

describe('pushSupport', () => {
  it('reports needs-install on an iPhone in a browser tab', () => {
    pretendIphoneInSafari();
    expect(pushSupport()).toBe('needs-install');
  });

  it('reports unsupported on a desktop browser genuinely lacking the APIs', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0)', platform: 'Win32', maxTouchPoints: 0 });
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    expect(pushSupport()).toBe('unsupported');
  });

  it('distinguishes the two, which is the whole point', () => {
    pretendIphoneInSafari();
    const ios = pushSupport();
    vi.unstubAllGlobals();
    vi.stubGlobal('navigator', { userAgent: 'Windows', platform: 'Win32', maxTouchPoints: 0 });
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    expect(ios).not.toBe(pushSupport());
  });
});

describe('shouldOfferPush', () => {
  it('never prompts someone who must install the app first', () => {
    // Prompting there is a dead end; their Settings row explains it instead.
    pretendIphoneInSafari();
    expect(shouldOfferPush(true)).toBe(false);
  });

  it('never prompts before a first check-in', () => {
    pretendIphoneInSafari();
    expect(shouldOfferPush(false)).toBe(false);
  });
});
