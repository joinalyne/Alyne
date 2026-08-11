import { createECDH } from 'node:crypto';

/**
 * Is the VAPID private key in this environment actually the partner of the
 * public key browsers subscribed against?
 *
 * This matters because nothing else catches a mismatch. web-push's
 * setVapidDetails() validates the FORMAT of both keys and no more, so it accepts
 * a mismatched pair without complaint. The failure surfaces only when a push
 * service rejects the signature — in production, on real devices, as an error
 * that reads like a bad subscription rather than a bad configuration.
 *
 * It is a live risk here rather than a theoretical one. The pair was rotated
 * twice, the second time delivering the private key by one-time link, and that
 * link was never opened. So whatever sits in VAPID_PRIVATE_KEY in production may
 * well not match the public key committed in the client bundle, and no amount of
 * local testing would reveal it: the local .env pair is correct.
 *
 * Deriving the public point from the private scalar is the only real check.
 */

const fromB64Url = (value: string): Buffer =>
  Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const toB64Url = (buffer: Buffer): string =>
  buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * The public key that belongs to this private key, or null if the private key is
 * not a usable P-256 scalar. Never throws: this runs on a request path, and a
 * malformed key must produce a diagnosable response rather than a 500 with a
 * stack trace.
 */
export function derivePublicKey(privateKey: string): string | null {
  try {
    const ecdh = createECDH('prime256v1');
    ecdh.setPrivateKey(fromB64Url(privateKey));
    return toB64Url(ecdh.getPublicKey());
  } catch {
    return null;
  }
}

export type VapidPairCheck = {
  ok: boolean;
  /** The public key implied by the private key. Safe to log or return: a public key is not a secret. */
  derived: string | null;
};

export function checkVapidPair(privateKey: string, publicKey: string): VapidPairCheck {
  const derived = derivePublicKey(privateKey);
  return { ok: derived !== null && derived === publicKey.trim(), derived };
}
