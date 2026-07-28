import { ChevronLeft, Camera, Pencil, LogOut, Check } from 'lucide-react';
import { Dumbbell, PenLine, BookOpen, Unlock, Sparkles, MoreHorizontal } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { supabase, updateDisplayName, changeGoal, uploadAvatar, type Goal } from '../lib/supabase';
import { useAuth } from '../contexts/useAuth';
import { Avatar } from '../components/Avatar';

const GOALS = [
  { id: 'fitness',     label: 'Fitness',     icon: Dumbbell },
  { id: 'writing',     label: 'Writing',     icon: PenLine },
  { id: 'learning',    label: 'Learning',    icon: BookOpen },
  { id: 'quitting',    label: 'Quitting',    icon: Unlock },
  { id: 'mindfulness', label: 'Mindfulness', icon: Sparkles },
  { id: 'other',       label: 'Other',       icon: MoreHorizontal },
];

const CARD_SHADOW = '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.07)';

export default function Settings() {
  const navigate = useNavigate();

  const { profile, refreshProfile } = useAuth();

  // Local state holds only what the user has just changed. Everything else is
  // derived from the real profile, so this screen can no longer show a stranger
  // their own account: it previously hardcoded "Alex Rivera" and
  // "alex@example.com", which reads as somebody else's data rather than as an
  // unfinished screen.
  const [savedName, setSavedName] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [pickedGoal, setPickedGoal] = useState<string | null>(null);
  const [goalExpanded, setGoalExpanded] = useState(false);
  const [uploadedAvatar, setUploadedAvatar] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  // The goal awaiting confirmation. Changing goal ends the pairing, so it is
  // never applied on a single tap.
  const [pendingGoal, setPendingGoal] = useState<Goal | null>(null);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = savedName ?? profile?.display_name ?? '';
  const email = profile?.email ?? '';
  const selectedGoal = pickedGoal ?? profile?.current_goal ?? 'fitness';
  const avatarUrl = uploadedAvatar ?? profile?.avatar_url ?? null;
  const plan = profile?.plan === 'paid' ? 'Paid' : 'Free';

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fall back rather than assert: a goal value the UI does not know about must
  // not crash the whole screen.
  const currentGoal = GOALS.find((g) => g.id === selectedGoal) ?? GOALS[0];
  const GoalIcon = currentGoal.icon;

  const saveName = async () => {
    const trimmed = draftName.trim();
    setEditingName(false);
    if (!trimmed || trimmed === name) return;
    setSavedName(trimmed); // optimistic — the field updates immediately
    await updateDisplayName(trimmed);
    await refreshProfile();
  };

  const onAvatarPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const localPreview = URL.createObjectURL(file);
    setUploadedAvatar(localPreview); // optimistic preview
    const publicUrl = await uploadAvatar(file);
    if (publicUrl) setUploadedAvatar(publicUrl);
    await refreshProfile();
    e.target.value = ''; // allow re-picking the same file
  };

  const onGoalPicked = (goalId: string) => {
    if (goalId === selectedGoal) {
      setGoalExpanded(false);
      return;
    }
    // Salomeh's decision, 2026-07-28: changing goal ends the current pairing
    // and requeues. Destructive, so it is confirmed rather than applied on a tap.
    setPendingGoal(goalId as Goal);
  };

  const confirmGoalChange = async () => {
    const goal = pendingGoal;
    if (!goal) return;
    setChanging(true);
    try {
      const result = await changeGoal(goal);
      if (!result.ok) {
        setError('Could not change your goal. Please try again.');
        setPendingGoal(null);
        return;
      }
      setPickedGoal(goal);
      setGoalExpanded(false);
      setPendingGoal(null);
      await refreshProfile();
      // Go where the change actually left them, so the consequence is visible
      // rather than implied.
      navigate(result.matchId ? '/matched' : '/finding-partner');
    } finally {
      setChanging(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full max-w-md mx-auto px-6 pb-10">

        {/* Top bar */}
        <div className="relative flex items-center justify-center pt-14 pb-8">
          <button
            onClick={() => navigate(-1)}
            className="absolute left-0 flex items-center justify-center w-10 h-10"
          >
            <ChevronLeft size={24} strokeWidth={1.5} color="#2B2B2B" />
          </button>
          <span style={{ color: '#2B2B2B', fontWeight: 600, fontSize: '1.1rem' }}>Settings</span>
        </div>

        {/* Profile card */}
        <div
          className="flex flex-col items-center py-8"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '1.25rem',
            boxShadow: CARD_SHADOW,
            marginBottom: '20px',
          }}
        >
          <div className="relative mb-4">
            {/* Avatar, not a bare <img>: avatarUrl is null for anyone who has
                not uploaded a photo, and a broken image is worse than none. */}
            <Avatar src={avatarUrl} name={name} size={96} borderColor="var(--background)" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 flex items-center justify-center w-8 h-8 rounded-full"
              style={{ backgroundColor: '#A8893F', border: '2px solid #FFFFFF' }}
              aria-label="Change profile photo"
            >
              <Camera size={14} color="#FFFFFF" strokeWidth={1.5} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onAvatarPicked}
            />
          </div>
          <p style={{ color: '#2B2B2B', fontWeight: 700, fontSize: '1.1rem' }}>{name}</p>
          <p style={{ color: '#8A8580', fontSize: '0.875rem', marginTop: '2px' }}>{email}</p>
        </div>

        {/* Account section */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '1.25rem',
            boxShadow: CARD_SHADOW,
            marginBottom: '20px',
            overflow: 'hidden',
          }}
        >
          <p
            style={{
              color: '#8A8580',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              padding: '16px 20px 8px',
            }}
          >
            Account
          </p>

          {/* Name row */}
          <div
            className="flex items-center justify-between"
            style={{ padding: '12px 20px', borderBottom: '1px solid rgba(43,43,43,0.06)' }}
          >
            <div className="flex-1">
              <p style={{ color: '#8A8580', fontSize: '0.78rem', marginBottom: '2px' }}>Name</p>
              {editingName ? (
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => void saveName()}
                  onKeyDown={(e) => { if (e.key === 'Enter') void saveName(); }}
                  className="focus:outline-none w-full"
                  style={{ color: '#2B2B2B', fontWeight: 500, fontSize: '0.95rem', background: 'transparent' }}
                />
              ) : (
                <p style={{ color: '#2B2B2B', fontWeight: 500, fontSize: '0.95rem' }}>{name}</p>
              )}
            </div>
            <button
              onClick={() => { setDraftName(name); setEditingName(true); }}
              className="flex items-center justify-center w-8 h-8 rounded-full ml-3"
              style={{ backgroundColor: '#F5F3F0' }}
            >
              <Pencil size={14} color="#2B2B2B" strokeWidth={1.5} />
            </button>
          </div>

          {/* Email row */}
          <div
            className="flex items-center justify-between"
            style={{ padding: '12px 20px' }}
          >
            <div>
              <p style={{ color: '#8A8580', fontSize: '0.78rem', marginBottom: '2px' }}>Email</p>
              <p style={{ color: '#2B2B2B', fontWeight: 500, fontSize: '0.95rem' }}>{email}</p>
            </div>
            <span style={{ color: '#8A8580', fontSize: '0.8rem' }}>Can't change</span>
          </div>
        </div>

        {/* Your goal section */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '1.25rem',
            boxShadow: CARD_SHADOW,
            marginBottom: '28px',
            overflow: 'hidden',
          }}
        >
          <p
            style={{
              color: '#8A8580',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              padding: '16px 20px 8px',
            }}
          >
            Your Goal
          </p>

          <div
            className="flex items-center justify-between"
            style={{ padding: '12px 20px', borderBottom: goalExpanded ? '1px solid rgba(43,43,43,0.06)' : 'none' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center w-10 h-10 rounded-full"
                style={{ backgroundColor: '#F5F3F0' }}
              >
                <GoalIcon size={18} color="#A8893F" strokeWidth={1.5} />
              </div>
              <p style={{ color: '#2B2B2B', fontWeight: 500, fontSize: '0.95rem' }}>
                {currentGoal.label}
              </p>
            </div>
            <button
              onClick={() => setGoalExpanded(!goalExpanded)}
              style={{ color: '#A8893F', fontWeight: 600, fontSize: '0.875rem' }}
            >
              {goalExpanded ? 'Done' : 'Change'}
            </button>
          </div>

          {/* Goal grid — expanded */}
          {goalExpanded && (
            <div
              className="grid grid-cols-2 gap-3"
              style={{ padding: '16px 20px', backgroundColor: 'var(--background)' }}
            >
              {GOALS.map((goal) => {
                const Icon = goal.icon;
                const isSelected = selectedGoal === goal.id;

                return (
                  <button
                    key={goal.id}
                    onClick={() => onGoalPicked(goal.id)}
                    className="relative flex flex-col items-center justify-center gap-3 transition-all duration-150 active:scale-[0.97]"
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '1.25rem',
                      padding: '20px 12px',
                      border: isSelected ? '1.5px solid #1A3328' : '1.5px solid transparent',
                      boxShadow: CARD_SHADOW,
                      minHeight: '120px',
                    }}
                  >
                    {isSelected && (
                      <div
                        className="absolute top-2.5 right-2.5 flex items-center justify-center w-5 h-5 rounded-full"
                        style={{ backgroundColor: '#1A3328' }}
                      >
                        <Check size={11} color="#FFFFFF" strokeWidth={2.5} />
                      </div>
                    )}
                    <div
                      className="flex items-center justify-center w-12 h-12 rounded-full"
                      style={{ backgroundColor: '#F5F3F0' }}
                    >
                      <Icon size={22} color="#A8893F" strokeWidth={1.5} />
                    </div>
                    <p style={{ color: '#2B2B2B', fontWeight: isSelected ? 600 : 500, fontSize: '0.9rem' }}>
                      {goal.label}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Membership */}
        {/* TODO(Jerome): when profiles.plan === 'paid', swap the "Upgrade" link for
            "Manage subscription" → Stripe Customer Portal session, and show the
            plan as "Alyne Plan · renews {date}" from the subscription record. */}
        <div
          className="rounded-[1.25rem] mb-7 overflow-hidden"
          style={{ backgroundColor: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.07)' }}
        >
          <p
            className="text-[0.75rem] uppercase px-5 pt-4 pb-2"
            style={{ color: '#8A8580', fontWeight: 600, letterSpacing: '0.07em' }}
          >
            Membership
          </p>
          <div className="flex items-center justify-between px-5 pb-4 pt-1">
            <div>
              <p className="text-[0.78rem] mb-0.5" style={{ color: '#8A8580' }}>Plan</p>
              <p className="text-[0.95rem]" style={{ color: '#2B2B2B', fontWeight: 500 }}>{plan}</p>
            </div>
            <Link
              to="/upgrade"
              className="text-[0.875rem]"
              style={{ color: '#A8893F', fontWeight: 600 }}
            >
              Upgrade
            </Link>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="mb-5 rounded-[1.25rem] px-5 py-3 text-center text-[0.9rem]"
            style={{ backgroundColor: '#fdf2f2', color: '#9b2c2c' }}
          >
            {error}
          </p>
        ) : null}

        {/* Sign out */}
        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
          style={{
            backgroundColor: '#104241',
            color: '#FFFFFF',
            borderRadius: '1.25rem',
            padding: '18px',
            fontSize: '1.05rem',
            fontWeight: 700,
            boxShadow: '0 4px 20px rgba(16,66,65,0.25)',
          }}
        >
          <LogOut size={18} strokeWidth={1.5} color="#FFFFFF" />
          {signingOut ? 'Signing out…' : 'Sign Out'}
        </button>

      </div>

      {/* Goal-change confirmation.
          Salomeh asked for a clear warning, and the wording is hers: changing
          goal ends the partnership. Modal rather than an inline toggle, because
          the consequence is not reversible. */}
      {pendingGoal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(43,43,43,0.45)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="goal-change-title"
        >
          <div
            className="w-full max-w-md m-4 p-6 rounded-[1.25rem]"
            style={{ backgroundColor: '#FFFFFF', boxShadow: CARD_SHADOW }}
          >
            <h2
              id="goal-change-title"
              className="text-[1.2rem] mb-2"
              style={{ color: '#1A3328', fontWeight: 600 }}
            >
              Change to {GOALS.find((g) => g.id === pendingGoal)?.label}?
            </h2>
            <p className="text-[0.95rem] leading-relaxed mb-6" style={{ color: '#8A8580' }}>
              This ends your current partnership and puts you back in the queue.
              Your streak resets when you are matched again.
            </p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => void confirmGoalChange()}
                disabled={changing}
                className="w-full rounded-[1.25rem] py-4 disabled:opacity-60"
                style={{
                  backgroundColor: '#104241', color: '#FFFFFF',
                  fontSize: '1rem', fontWeight: 700,
                }}
              >
                {changing ? 'Changing…' : 'Change goal and find someone new'}
              </button>
              <button
                type="button"
                onClick={() => setPendingGoal(null)}
                disabled={changing}
                className="w-full rounded-[1.25rem] py-4 disabled:opacity-60"
                style={{
                  backgroundColor: '#FFFFFF', color: '#2B2B2B',
                  fontSize: '1rem', fontWeight: 600,
                  border: '1.5px solid rgba(43,43,43,0.15)',
                }}
              >
                Keep my current partner
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
