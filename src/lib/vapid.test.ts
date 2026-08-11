import { describe, it, expect } from 'vitest';
import { createECDH } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { derivePublicKey, checkVapidPair } from '../../api/_vapid';

/**
 * Is the committed VAPID public key really the partner of the private key in use?
 *
 * This test exists because the obvious check was worthless. web-push's
 * setVapidDetails() accepts a MISMATCHED pair without complaint: it validates
 * the format and nothing else. So "web-push accepted the keys" said only that
 * they were the right length.
 *
 * A mismatch does not fail locally, or at build, or at deploy. It fails when a
 * push service rejects the signature, which is production, on real users, with
 * a signature error that reads like a subscription problem rather than a
 * configuration one.
 *
 * Deriving the public point from the private scalar is the only real check.
 */

const fromB64Url = (s: string) =>
  Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const toB64Url = (b: Buffer) =>
  b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * The real implementation, not a copy of it. This test used to derive the key
 * itself, which meant it verified the keys but not the code that now guards them
 * at runtime.
 */
function derivePublic(privateKey: string): string {
  const derived = derivePublicKey(privateKey);
  if (!derived) throw new Error('not a valid P-256 private key');
  return derived;
}

/** The key committed in the client, which is what browsers subscribe against. */
function committedPublicKey(): string {
  const source = readFileSync(join(process.cwd(), 'src', 'lib', 'push.ts'), 'utf8');
  const match = source.match(/DEFAULT_VAPID_PUBLIC_KEY\s*=\s*\n?\s*'([^']+)'/);
  if (!match) throw new Error('could not find DEFAULT_VAPID_PUBLIC_KEY in src/lib/push.ts');
  return match[1];
}

function localPrivateKey(): string | null {
  try {
    const env = readFileSync(join(process.cwd(), '.env'), 'utf8');
    const line = env.split('\n').find((l) => l.startsWith('VAPID_PRIVATE_KEY='));
    return line ? line.slice('VAPID_PRIVATE_KEY='.length).trim() : null;
  } catch {
    return null;
  }
}

describe('VAPID keys', () => {
  it('the committed public key is a valid P-256 point', () => {
    const key = committedPublicKey();
    expect(key).toHaveLength(87);
    // 0x04 marks an uncompressed point; anything else is not a public key.
    expect(fromB64Url(key)[0]).toBe(0x04);
    expect(fromB64Url(key)).toHaveLength(65);
  });

  it('the local private key derives exactly the committed public key', () => {
    const priv = localPrivateKey();
    if (!priv) {
      // CI has no .env. The check above still guards the committed half.
      expect(committedPublicKey()).toBeTruthy();
      return;
    }
    expect(derivePublic(priv)).toBe(committedPublicKey());
  });

  it('a wrong private key does NOT derive it, so this test can actually fail', () => {
    // Guards the guard. A check that passes for any input is not a check.
    const other = createECDH('prime256v1');
    other.generateKeys();
    expect(toB64Url(other.getPublicKey())).not.toBe(committedPublicKey());
  });

  it('the key burned in chat is no longer the one in the code', () => {
    expect(committedPublicKey()).not.toBe(
      'BG4cYI7IE94HYTjibOeJPI4Skri22tvuxHTKTlSz9mKDXfEo_WmTaLCV_3Sw9gLOfQBeVWYhICgX5qhmMd-X3I4',
    );
    expect(derivePublic('Pqlg4epll_D1AhSzK-Qh-i0joO9sGH5_gShqm5iAVEw')).not.toBe(
      committedPublicKey(),
    );
  });
});

/**
 * The runtime guard in api/send-notifications.ts. The pair was rotated twice and
 * the one-time link carrying the second private key was never opened, so a
 * production mismatch is a live possibility rather than a hypothetical one.
 */
describe('the runtime pair check', () => {
  const pair = () => {
    const ecdh = createECDH('prime256v1');
    ecdh.generateKeys();
    return {
      priv: toB64Url(ecdh.getPrivateKey()),
      pub: toB64Url(ecdh.getPublicKey()),
    };
  };

  it('accepts a genuine pair', () => {
    const { priv, pub } = pair();
    expect(checkVapidPair(priv, pub)).toEqual({ ok: true, derived: pub });
  });

  it('rejects two valid keys that are not partners', () => {
    // Exactly what web-push accepts without complaint, and the reason this
    // exists at all.
    const a = pair();
    const b = pair();
    const result = checkVapidPair(a.priv, b.pub);
    expect(result.ok).toBe(false);
    expect(result.derived).toBe(a.pub);
  });

  it('reports the key that WOULD match, so the error is actionable', () => {
    const a = pair();
    const b = pair();
    // The derived key is what VITE_VAPID_PUBLIC_KEY should be set to. It is a
    // public key, so returning it in an error response leaks nothing.
    expect(checkVapidPair(a.priv, b.pub).derived).toBe(a.pub);
  });

  it('does not throw on a malformed private key', () => {
    // This runs on a request path; a bad value must give a diagnosable response
    // rather than a 500.
    for (const bad of ['', 'not-base64!!', 'AAAA', 'x'.repeat(200)]) {
      expect(() => checkVapidPair(bad, 'irrelevant')).not.toThrow();
      expect(checkVapidPair(bad, 'irrelevant').ok).toBe(false);
    }
  });

  it('tolerates whitespace on the public key, as env vars carry newlines', () => {
    const { priv, pub } = pair();
    expect(checkVapidPair(priv, `${pub}\n`).ok).toBe(true);
  });

  it('agrees with the committed pair the app actually ships', () => {
    const priv = localPrivateKey();
    if (!priv) return; // CI has no .env
    expect(checkVapidPair(priv, committedPublicKey()).ok).toBe(true);
  });
});
