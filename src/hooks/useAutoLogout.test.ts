import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoLogout, AUTO_LOGOUT_IDLE_MS } from './useAutoLogout';
import { supabase } from '../lib/supabase';

describe('useAutoLogout', () => {
  let signOut: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    signOut = vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does nothing while disabled, so a signed-out visitor is left alone', () => {
    renderHook(() => useAutoLogout(false));
    vi.advanceTimersByTime(AUTO_LOGOUT_IDLE_MS * 2);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('stays signed in below the idle limit', () => {
    renderHook(() => useAutoLogout(true));
    vi.advanceTimersByTime(AUTO_LOGOUT_IDLE_MS - 60_000);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('signs out once the idle limit passes', () => {
    renderHook(() => useAutoLogout(true));
    vi.advanceTimersByTime(AUTO_LOGOUT_IDLE_MS + 60_000);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('interaction resets the clock', () => {
    renderHook(() => useAutoLogout(true));
    vi.advanceTimersByTime(AUTO_LOGOUT_IDLE_MS - 60_000);
    window.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(AUTO_LOGOUT_IDLE_MS - 60_000);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('records activity where other tabs can see it', () => {
    renderHook(() => useAutoLogout(true));
    expect(localStorage.getItem('alyne:last-active')).not.toBeNull();
  });

  it('activity in another tab keeps this one signed in', () => {
    // The reason this is not a plain in-memory timer: a background tab must not
    // sign the user out while they are busy in a different one.
    renderHook(() => useAutoLogout(true));
    vi.advanceTimersByTime(AUTO_LOGOUT_IDLE_MS - 60_000);
    localStorage.setItem('alyne:last-active', String(Date.now()));
    vi.advanceTimersByTime(120_000);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('stops watching once unmounted', () => {
    const { unmount } = renderHook(() => useAutoLogout(true));
    unmount();
    vi.advanceTimersByTime(AUTO_LOGOUT_IDLE_MS * 2);
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe('useAutoLogout, once idle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('signs out exactly once, not on every subsequent tick', () => {
    // The first version kept firing every minute, because the stored timestamp
    // stayed old after signing out.
    const signOut = vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null });
    renderHook(() => useAutoLogout(true));
    vi.advanceTimersByTime(AUTO_LOGOUT_IDLE_MS + 10 * 60_000);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
