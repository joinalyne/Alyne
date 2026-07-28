import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Clock, Users, Flag } from 'lucide-react';
import { AlyneWordmark } from '../components/AlyneWordmark';
import {
  getAdminOverview, endMatch as endMatchRpc,
  type AdminOverview, type AdminPair, type AdminQueueEntry,
} from '../lib/supabase';
import { goalLabel } from '../lib/goals';

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — internal tool, gated to Salomeh only.
//
// Gating: the route is wrapped in <RequireAdmin> (see routes.tsx), backed by
// profiles.is_admin. That is navigation only. The real boundary is that every
// query below goes through admin_overview(), which raises 42501 for a
// non-admin, and RLS denies the underlying tables regardless.
//
// The three lists come from ONE rpc rather than three client queries:
// `matches` has two foreign keys to `profiles`, which makes PostgREST embeds
// awkward to name, and embedded joins return stale rows straight after a
// write - which matters here because ending a match re-reads the list
// immediately. See migration 0007.
//
// Streaks reset when a pair is NEXT matched, not when a match ends, per spec.
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — internal tool, gated to Salomeh only.
//
// TODO(Jerome): gate this route behind Salomeh's Supabase auth (role claim or
//               is_admin flag — your call per the schema proposal RLS section).
// TODO(Jerome): replace MOCK_* below with Supabase queries:
//   - flagged pairs: active matches where either user's last_check_in_date
//     is 3+ days old (the inactive-partner rule)
//   - active pairs: matches where status = 'active'
//   - queue: match_queue where status = 'waiting' order by enqueued_at (FIFO)
// TODO(Jerome): wire endMatch(id) → set matches.status='ended',
//   ended_at=now(), ended_by='admin'; both users' streaks reset on rematch
//   per spec (reset happens at new match creation, not here).
// ─────────────────────────────────────────────────────────────────────────────

const CARD_SHADOW = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.07)';

type Pair = {
  id: string;
  goal: string;
  a: { name: string; streak: number; lastCheckIn: string };
  b: { name: string; streak: number; lastCheckIn: string };
  daysSilent?: number; // present when flagged
};

/**
 * Human wording for a last-check-in date. `null` means they have never checked
 * in at all, which is not the same as "a long time ago" and should not read as
 * though it were.
 */
function lastCheckInLabel(date: string | null): string {
  if (!date) return 'never';
  const today = new Date().toLocaleDateString('en-CA');
  if (date === today) return 'today';
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA');
  if (date === yesterday) return 'yesterday';
  const days = Math.round((Date.parse(today) - Date.parse(date)) / 86_400_000);
  return days + ' days ago';
}

function waitingFor(enqueuedAt: string): string {
  const minutes = Math.floor((Date.now() - Date.parse(enqueuedAt)) / 60_000);
  if (minutes < 60) return minutes + ' min';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + ' hours';
  const days = Math.floor(hours / 24);
  return days + (days === 1 ? ' day' : ' days');
}

/** Flatten an rpc row into the shape PairCard already expects. */
function toPair(row: AdminPair): Pair {
  return {
    id: row.id,
    goal: goalLabel(row.goal),
    daysSilent: row.days_silent,
    a: { name: row.a_name ?? 'Unnamed', streak: row.a_streak, lastCheckIn: lastCheckInLabel(row.a_last) },
    b: { name: row.b_name ?? 'Unnamed', streak: row.b_streak, lastCheckIn: lastCheckInLabel(row.b_last) },
  };
}

const sectionLabel = {
  color: '#8A8580', fontWeight: 600, letterSpacing: '0.07em',
} as const;

function EndMatchButton({ onConfirm }: { onConfirm: () => void }) {
  const [arming, setArming] = useState(false);
  if (!arming) {
    return (
      <button
        onClick={() => setArming(true)}
        className="text-[0.85rem] rounded-full px-4 py-2"
        style={{ color: '#2B2B2B', fontWeight: 600, border: '1.5px solid rgba(43,43,43,0.15)', background: '#FFFFFF' }}
      >
        End match
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onConfirm}
        className="text-[0.85rem] rounded-full px-4 py-2"
        style={{ color: '#FFFFFF', fontWeight: 600, background: '#2B2B2B' }}
      >
        Confirm end?
      </button>
      <button
        onClick={() => setArming(false)}
        className="text-[0.85rem]"
        style={{ color: '#8A8580', fontWeight: 600 }}
      >
        Cancel
      </button>
    </div>
  );
}

function PairCard({ pair, flagged, onEnd }: { pair: Pair; flagged?: boolean; onEnd: (id: string) => void }) {
  return (
    <div className="rounded-[1.25rem] p-5 mb-3" style={{ background: '#FFFFFF', boxShadow: CARD_SHADOW }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[0.75rem] uppercase" style={sectionLabel}>{pair.goal}</span>
          {flagged && (
            <span
              className="inline-flex items-center gap-1 text-[0.72rem] uppercase rounded-full px-2.5 py-1"
              style={{ color: '#A8893F', fontWeight: 600, letterSpacing: '0.05em', background: '#F5F3F0' }}
            >
              <Flag size={11} strokeWidth={1.5} /> {pair.daysSilent} days silent
            </span>
          )}
        </div>
        <EndMatchButton onConfirm={() => onEnd(pair.id)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[pair.a, pair.b].map((u, i) => (
          <div key={i} className="flex items-center justify-between rounded-[1.25rem] px-4 py-3" style={{ background: '#F5F3F0' }}>
            <div>
              <p className="text-[0.95rem]" style={{ color: '#2B2B2B', fontWeight: 500 }}>{u.name}</p>
              <p className="text-[0.78rem]" style={{ color: u.lastCheckIn.includes('days') ? '#A8893F' : '#8A8580' }}>
                Last check-in: {u.lastCheckIn}
              </p>
            </div>
            <p className="text-[1.1rem]" style={{ color: '#104241', fontWeight: 700 }}>{u.streak}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Admin() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await getAdminOverview();
    if (!data) setError('Could not load the overview.');
    setOverview(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const endMatch = async (id: string) => {
    // Optimistic, then re-read. Dropping it immediately makes the button feel
    // instant; re-reading means the pair reappears if the call actually failed,
    // rather than silently vanishing from Salomeh's view.
    setOverview((current) =>
      current
        ? {
            ...current,
            flagged: current.flagged.filter((m) => m.id !== id),
            active: current.active.filter((m) => m.id !== id),
          }
        : current,
    );
    await endMatchRpc(id);
    await load();
  };

  const flagged: Pair[] = (overview?.flagged ?? []).map(toPair);
  const active: Pair[] = (overview?.active ?? []).map(toPair);
  const queue: AdminQueueEntry[] = overview?.queue ?? [];

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <AlyneWordmark className="w-24" />
          <span
            className="inline-flex items-center gap-1.5 text-[0.75rem] uppercase rounded-full px-3 py-1.5"
            style={{ ...sectionLabel, background: '#FFFFFF', boxShadow: CARD_SHADOW }}
          >
            <ShieldCheck size={13} strokeWidth={1.5} color="#104241" /> Admin
          </span>
        </div>

        {error ? (
          <p
            role="alert"
            className="mb-6 rounded-[1.25rem] px-5 py-3 text-center text-[0.9rem]"
            style={{ backgroundColor: '#fdf2f2', color: '#9b2c2c' }}
          >
            {error}
          </p>
        ) : null}

        {/* Needs attention */}
        <div className="flex items-center gap-2 mb-3">
          <Flag size={14} strokeWidth={1.5} color="#A8893F" />
          <p className="text-[0.75rem] uppercase" style={sectionLabel}>Needs attention</p>
        </div>
        {flagged.length === 0 ? (
          <p className="text-[0.9rem] mb-6" style={{ color: '#8A8580' }}>No flagged pairs. 🌱</p>
        ) : (
          <div className="mb-6">{flagged.map((p) => <PairCard key={p.id} pair={p} flagged onEnd={endMatch} />)}</div>
        )}

        {/* Active pairs */}
        <div className="flex items-center gap-2 mb-3 mt-8">
          <Users size={14} strokeWidth={1.5} color="#104241" />
          <p className="text-[0.75rem] uppercase" style={sectionLabel}>Active pairs</p>
        </div>
        {active.length === 0 ? (
          <p className="text-[0.9rem] mb-6" style={{ color: '#8A8580' }}>No active pairs yet.</p>
        ) : (
          <div className="mb-6">{active.map((p) => <PairCard key={p.id} pair={p} onEnd={endMatch} />)}</div>
        )}

        {/* Waiting queue */}
        <div className="flex items-center gap-2 mb-3 mt-8">
          <Clock size={14} strokeWidth={1.5} color="#A8893F" />
          <p className="text-[0.75rem] uppercase" style={sectionLabel}>Waiting queue (FIFO)</p>
        </div>
        {queue.length === 0 ? (
          <p className="text-[0.9rem]" style={{ color: '#8A8580' }}>Nobody waiting.</p>
        ) : (
        <div className="rounded-[1.25rem]" style={{ background: '#FFFFFF', boxShadow: CARD_SHADOW }}>
          {queue.map((q, i) => (
            <div
              key={q.id}
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: i < queue.length - 1 ? '1px solid rgba(43,43,43,0.06)' : 'none' }}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-7 h-7 rounded-full" style={{ background: '#F5F3F0' }}>
                  <span className="text-[0.78rem]" style={{ color: '#A8893F', fontWeight: 700 }}>{i + 1}</span>
                </div>
                <div>
                  <p className="text-[0.95rem]" style={{ color: '#2B2B2B', fontWeight: 500 }}>{q.name ?? 'Unnamed'}{q.priority ? <span className="ml-2 text-[0.7rem] uppercase" style={{ color: '#A8893F', fontWeight: 700 }}>priority</span> : null}</p>
                  <p className="text-[0.78rem]" style={{ color: '#8A8580' }}>{goalLabel(q.goal)}</p>
                </div>
              </div>
              <p className="text-[0.85rem]" style={{ color: '#8A8580' }}>waiting {waitingFor(q.enqueued_at)}</p>
            </div>
          ))}
        </div>
        )}

      </div>
    </div>
  );
}
