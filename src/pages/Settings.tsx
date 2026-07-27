import { ChevronLeft, Camera, Pencil, LogOut, Check } from 'lucide-react';
import { Dumbbell, PenLine, BookOpen, Unlock, Sparkles, MoreHorizontal } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { updateDisplayName, uploadAvatar } from '../lib/supabase';

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

  const [name, setName] = useState('Alex Rivera');
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [selectedGoal, setSelectedGoal] = useState('fitness');
  const [goalExpanded, setGoalExpanded] = useState(false);

  const email = 'alex@example.com';
  const [avatarUrl, setAvatarUrl] = useState(
    'https://images.unsplash.com/photo-1581564018992-95e729d4940e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200'
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentGoal = GOALS.find((g) => g.id === selectedGoal)!;
  const GoalIcon = currentGoal.icon;

  const saveName = () => {
    const trimmed = draftName.trim();
    if (trimmed) {
      setName(trimmed); // optimistic — UI updates immediately
      void updateDisplayName(trimmed); // persists when Supabase is configured
    }
    setEditingName(false);
  };

  const onAvatarPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const localPreview = URL.createObjectURL(file);
    setAvatarUrl(localPreview); // optimistic preview
    const publicUrl = await uploadAvatar(file); // persists when Supabase is configured
    if (publicUrl) setAvatarUrl(publicUrl);
    e.target.value = ''; // allow re-picking the same file
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
            <img
              src={avatarUrl}
              alt={name}
              className="w-24 h-24 rounded-full object-cover"
              style={{ border: '3px solid var(--background)' }}
            />
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
                  onBlur={saveName}
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
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
                    onClick={() => setSelectedGoal(goal.id)}
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
              <p className="text-[0.95rem]" style={{ color: '#2B2B2B', fontWeight: 500 }}>Free</p>
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

        {/* Sign out */}
        <button
          className="w-full flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
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
          Sign Out
        </button>

      </div>
    </div>
  );
}
