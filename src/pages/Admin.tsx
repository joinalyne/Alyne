import { useState } from 'react';
import { ShieldCheck, Clock, Users, Flag } from 'lucide-react';
import { AlyneWordmark } from '../components/AlyneWordmark';

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

const MOCK_FLAGGED: Pair[] = [
  { id: 'm1', goal: 'Fitness', daysSilent: 4,
    a: { name: 'Dana K.', streak: 9, lastCheckIn: 'today' },
    b: { name: 'Chris P.', streak: 0, lastCheckIn: '4 days ago' } },
  { id: 'm2', goal: 'Writing', daysSilent: 3,
    a: { name: 'Sam O.', streak: 12, lastCheckIn: 'yesterday' },
    b: { name: 'Lee W.', streak: 0, lastCheckIn: '3 days ago' } },
];

const MOCK_ACTIVE: Pair[] = [
  { id: 'm3', goal: 'Mindfulness',
    a: { name: 'Alex R.', streak: 5, lastCheckIn: 'today' },
    b: { name: 'Jamie T.', streak: 12, lastCheckIn: 'today' } },
  { id: 'm4', goal: 'Learning',
    a: { name: 'Priya N.', streak: 21, lastCheckIn: 'today' },
    b: { name: 'Marco D.', streak: 21, lastCheckIn: 'yesterday' } },
];

const MOCK_QUEUE = [
  { id: 'q1', name: 'Jordan F.', goal: 'Fitness', waiting: '2 hours' },
  { id: 'q2', name: 'Robin S.', goal: 'Quitting', waiting: '1 day' },
  { id: 'q3', name: 'Casey M.', goal: 'Fitness', waiting: '2 days' },
];

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
  const [flagged, setFlagged] = useState(MOCK_FLAGGED);
  const [active, setActive] = useState(MOCK_ACTIVE);

  const endMatch = (id: string) => {
    // TODO(Jerome): call Supabase — matches.status='ended', ended_at=now(), ended_by='admin'
    setFlagged((p) => p.filter((m) => m.id !== id));
    setActive((p) => p.filter((m) => m.id !== id));
  };

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
        <div className="mb-6">{active.map((p) => <PairCard key={p.id} pair={p} onEnd={endMatch} />)}</div>

        {/* Waiting queue */}
        <div className="flex items-center gap-2 mb-3 mt-8">
          <Clock size={14} strokeWidth={1.5} color="#A8893F" />
          <p className="text-[0.75rem] uppercase" style={sectionLabel}>Waiting queue (FIFO)</p>
        </div>
        <div className="rounded-[1.25rem]" style={{ background: '#FFFFFF', boxShadow: CARD_SHADOW }}>
          {MOCK_QUEUE.map((q, i) => (
            <div
              key={q.id}
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: i < MOCK_QUEUE.length - 1 ? '1px solid rgba(43,43,43,0.06)' : 'none' }}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-7 h-7 rounded-full" style={{ background: '#F5F3F0' }}>
                  <span className="text-[0.78rem]" style={{ color: '#A8893F', fontWeight: 700 }}>{i + 1}</span>
                </div>
                <div>
                  <p className="text-[0.95rem]" style={{ color: '#2B2B2B', fontWeight: 500 }}>{q.name}</p>
                  <p className="text-[0.78rem]" style={{ color: '#8A8580' }}>{q.goal}</p>
                </div>
              </div>
              <p className="text-[0.85rem]" style={{ color: '#8A8580' }}>waiting {q.waiting}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
