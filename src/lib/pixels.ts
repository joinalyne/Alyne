/**
 * Ad-platform conversion pixels.
 *
 * PostHog already answers "what are people doing in the app". These answer a
 * different question: they tell Reddit and Meta which *ad click* turned into a
 * signup, which is what those platforms optimise delivery against. Without
 * them the auction has nothing to aim at but clicks, and clicks are not the
 * thing being bought here — a signup is, and two signups are a match.
 *
 * Both are off unless their ID is set, so local dev, preview deploys and the
 * test suite load no third-party script at all. Reddit is first in the channel
 * plan, so its pixel is the one that matters for the opening test; Meta's is
 * here so Instagram is not blocked on a code change later.
 *
 * Note for later: these set advertising cookies. Fine for the US/Canada
 * targeting the first test uses, but EU/UK delivery would need a consent gate
 * in front of `initPixels()`.
 */

type PixelArgs = unknown[];

type RedditPixel = ((...args: PixelArgs) => void) & {
  callQueue?: PixelArgs[];
  sendEvent?: (...args: PixelArgs) => void;
};

type MetaPixel = ((...args: PixelArgs) => void) & {
  callMethod?: (...args: PixelArgs) => void;
  queue?: PixelArgs[];
  loaded?: boolean;
  version?: string;
  push?: unknown;
};

declare global {
  interface Window {
    rdt?: RedditPixel;
    fbq?: MetaPixel;
    _fbq?: MetaPixel;
  }
}

const REDDIT_PIXEL_ID = import.meta.env.VITE_REDDIT_PIXEL_ID?.trim();
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID?.trim();

/** Both vendors want their tag appended ahead of the first existing script. */
function loadScript(src: string): void {
  const tag = document.createElement('script');
  tag.async = true;
  tag.src = src;
  const first = document.getElementsByTagName('script')[0];
  first?.parentNode?.insertBefore(tag, first);
}

function initReddit(id: string): void {
  if (window.rdt) return;

  // Queue calls made before pixel.js lands, exactly as Reddit's own snippet
  // does; the loaded script drains callQueue through sendEvent.
  const rdt: RedditPixel = function (...args: PixelArgs) {
    if (rdt.sendEvent) rdt.sendEvent(...args);
    else rdt.callQueue?.push(args);
  };
  rdt.callQueue = [];
  window.rdt = rdt;

  loadScript('https://www.redditstatic.com/ads/pixel.js');
  rdt('init', id);
  rdt('track', 'PageVisit');
}

function initMeta(id: string): void {
  if (window.fbq) return;

  const fbq: MetaPixel = function (...args: PixelArgs) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue?.push(args);
  };
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.push = fbq;
  window.fbq = fbq;
  window._fbq = fbq;

  loadScript('https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', id);
  fbq('track', 'PageView');
}

/** Called once at startup from main.tsx. A no-op when no IDs are configured. */
export function initPixels(): void {
  if (typeof window === 'undefined') return;
  if (REDDIT_PIXEL_ID) initReddit(REDDIT_PIXEL_ID);
  if (META_PIXEL_ID) initMeta(META_PIXEL_ID);
}

/**
 * The one conversion that matters. Fired when Supabase accepts the signup —
 * before email confirmation, deliberately: the ad did its job at that point,
 * and holding the event back until confirmation would hide a chunk of real
 * conversions from the optimiser and make CPA look worse than it is.
 */
export function trackSignup(): void {
  if (typeof window === 'undefined') return;
  window.rdt?.('track', 'SignUp');
  window.fbq?.('track', 'CompleteRegistration');
}
