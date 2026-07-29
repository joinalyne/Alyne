import { supabase } from './supabase';

/**
 * Push subscription handling.
 *
 * Salomeh's spec is explicit that the browser prompt must NOT fire on first
 * load: Chrome suppresses the prompt after repeated dismissals, and users deny
 * reflexively when asked before they understand why. So the real prompt is only
 * reached through a soft in-app ask, shown after a user's first check-in, and a
 * denial is never re-prompted.
 */

const PROMPTED_KEY = 'alyne:push-asked';

export type PushSupport = 'ready' | 'unsupported' | 'denied' | 'granted';

/**
 * iOS is the important case. Safari only allows push once the PWA has been
 * added to the home screen, so on an iPhone in a browser tab there is nothing
 * to offer and asking would be a dead end.
 */
export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return 'ready';
}

/** Whether the soft ask has already been shown, so it is never shown twice. */
export function hasBeenAsked(): boolean {
  try {
    return localStorage.getItem(PROMPTED_KEY) === '1';
  } catch {
    // Private browsing can refuse reads. Asking again is a smaller harm than
    // never asking at all.
    return false;
  }
}

export function markAsked(): void {
  try {
    localStorage.setItem(PROMPTED_KEY, '1');
  } catch {
    // Nothing useful to do; the worst case is being asked once more.
  }
}

/**
 * Should the soft pre-prompt be offered right now?
 *
 * Only after a first check-in, only if push is actually available, and only
 * once. `justCheckedIn` is the trigger her spec specifies.
 */
export function shouldOfferPush(justCheckedIn: boolean): boolean {
  return justCheckedIn && pushSupport() === 'ready' && !hasBeenAsked();
}

/**
 * The VAPID public key. Defaulted rather than required, because it is not a
 * secret: it is handed to every browser that subscribes, by design.
 *
 * Defaulting it means the client half of push needs no configuration at all.
 * Only the matching PRIVATE key has to be set, server-side, to actually send.
 */
const DEFAULT_VAPID_PUBLIC_KEY =
  'BMTB2zX7yeQp96twPlwuDwbVQdMg9F508rY--FRtOwfOW3VYGKojak4nqNmPpqXEzsf5uw0TiyHE5x4GyJd5UX8';

function vapidPublicKey(): string {
  return import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() || DEFAULT_VAPID_PUBLIC_KEY;
}

/**
 * Web Push wants the key as a Uint8Array, but VAPID keys are distributed as
 * base64url. Converting by hand because the two alphabets differ and padding is
 * omitted, which atob will not accept.
 */
function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalised);
  // Returns the ArrayBuffer rather than the view: applicationServerKey wants a
  // BufferSource, and recent TypeScript will not widen a generic Uint8Array to
  // one.
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))).buffer;
}

/**
 * Ask the browser for permission and register a subscription.
 *
 * Only call this from a user gesture, after they have accepted the soft ask.
 * Returns true only if a subscription was actually stored.
 */
export async function enablePush(): Promise<boolean> {
  markAsked();

  const key = vapidPublicKey();

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  try {
    const registration = await navigator.serviceWorker.ready;

    // Reuse an existing subscription rather than creating a duplicate, which
    // would leave a dead endpoint behind on the server.
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      }));

    return await storeSubscription(subscription);
  } catch (err) {
    console.error('[push] subscribe failed:', err);
    return false;
  }
}

async function storeSubscription(subscription: PushSubscription): Promise<boolean> {
  const raw = subscription.toJSON();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;

  if (!raw.keys?.p256dh || !raw.keys?.auth) {
    console.error('[push] subscription is missing its encryption keys');
    return false;
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: data.user.id,
      endpoint: subscription.endpoint,
      p256dh: raw.keys.p256dh,
      auth: raw.keys.auth,
      user_agent: navigator.userAgent.slice(0, 300),
    },
    // The endpoint is the browser's own identifier for this subscription, so a
    // repeat registration should refresh the row rather than fail on the
    // unique constraint.
    { onConflict: 'endpoint', ignoreDuplicates: false },
  );

  if (error) {
    console.error('[push] could not store subscription:', error.message);
    return false;
  }
  return true;
}

/** Turn push off on this device, and forget the endpoint server-side. */
export async function disablePush(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    await subscription.unsubscribe();
  } catch (err) {
    console.error('[push] unsubscribe failed:', err);
  }
}
