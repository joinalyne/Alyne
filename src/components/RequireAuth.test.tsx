import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { RequireAuth, RequireAdmin, RedirectIfSignedIn } from './RequireAuth';
import type { Profile } from '../contexts/auth-context';

const mockAuth = vi.fn();
vi.mock('../contexts/useAuth', () => ({ useAuth: () => mockAuth() }));

const profile = (over: Partial<Profile> = {}): Profile => ({
  id: 'u1',
  email: 'a@test.alyne',
  display_name: 'Ada',
  avatar_url: null,
  timezone: 'America/Vancouver',
  current_goal: 'writing',
  plan: 'free',
  current_streak: 0,
  last_check_in_date: null,
  is_admin: false,
  ...over,
});

/** Render a guard and report which route we ended up on. */
function landsOn(guard: React.ReactNode) {
  render(
    <MemoryRouter initialEntries={['/start']}>
      <Routes>
        <Route path="/start" element={guard} />
        <Route path="/" element={<div>auth screen</div>} />
        <Route path="/home" element={<div>home</div>} />
        <Route path="/profile-setup" element={<div>profile setup</div>} />
        <Route path="/goal-selection" element={<div>goal selection</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => mockAuth.mockReset());

describe('RequireAuth', () => {
  it('renders nothing while the session is still resolving', () => {
    // Not a spinner: the session usually resolves from local storage within a
    // frame, and a flashed loader reads as a bug.
    mockAuth.mockReturnValue({ session: null, profile: null, loading: true });
    const { container } = render(
      <MemoryRouter><RequireAuth><div>secret</div></RequireAuth></MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('sends a signed-out visitor to the auth screen', () => {
    mockAuth.mockReturnValue({ session: null, profile: null, loading: false });
    landsOn(<RequireAuth><div>secret</div></RequireAuth>);
    expect(screen.getByText('auth screen')).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('lets a fully onboarded user through', () => {
    mockAuth.mockReturnValue({ session: {}, profile: profile(), loading: false });
    landsOn(<RequireAuth><div>secret</div></RequireAuth>);
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('sends a user with no name back to profile setup', () => {
    mockAuth.mockReturnValue({
      session: {}, profile: profile({ display_name: null }), loading: false,
    });
    landsOn(<RequireAuth><div>secret</div></RequireAuth>);
    expect(screen.getByText('profile setup')).toBeInTheDocument();
  });

  it('sends a named user with no goal to goal selection', () => {
    mockAuth.mockReturnValue({
      session: {}, profile: profile({ current_goal: null }), loading: false,
    });
    landsOn(<RequireAuth><div>secret</div></RequireAuth>);
    expect(screen.getByText('goal selection')).toBeInTheDocument();
  });

  it('does not demand onboarding on the onboarding screens themselves', () => {
    // Without requireOnboarded={false}, ProfileSetup would redirect to itself.
    mockAuth.mockReturnValue({
      session: {}, profile: null, loading: false,
    });
    landsOn(<RequireAuth requireOnboarded={false}><div>setup form</div></RequireAuth>);
    expect(screen.getByText('setup form')).toBeInTheDocument();
  });

  it('still blocks a signed-out visitor on the onboarding screens', () => {
    mockAuth.mockReturnValue({ session: null, profile: null, loading: false });
    landsOn(<RequireAuth requireOnboarded={false}><div>setup form</div></RequireAuth>);
    expect(screen.getByText('auth screen')).toBeInTheDocument();
  });
});

describe('RequireAdmin', () => {
  it('admits an admin', () => {
    mockAuth.mockReturnValue({
      session: {}, profile: profile({ is_admin: true }), loading: false,
    });
    landsOn(<RequireAdmin><div>admin panel</div></RequireAdmin>);
    expect(screen.getByText('admin panel')).toBeInTheDocument();
  });

  it('bounces an ordinary user to home', () => {
    mockAuth.mockReturnValue({ session: {}, profile: profile(), loading: false });
    landsOn(<RequireAdmin><div>admin panel</div></RequireAdmin>);
    expect(screen.getByText('home')).toBeInTheDocument();
    expect(screen.queryByText('admin panel')).not.toBeInTheDocument();
  });

  it('bounces a signed-out visitor to the auth screen', () => {
    mockAuth.mockReturnValue({ session: null, profile: null, loading: false });
    landsOn(<RequireAdmin><div>admin panel</div></RequireAdmin>);
    expect(screen.getByText('auth screen')).toBeInTheDocument();
  });
});

describe('RedirectIfSignedIn', () => {
  it('shows the auth form to a signed-out visitor', () => {
    mockAuth.mockReturnValue({ session: null, profile: null, loading: false });
    landsOn(<RedirectIfSignedIn><div>sign up form</div></RedirectIfSignedIn>);
    expect(screen.getByText('sign up form')).toBeInTheDocument();
  });

  it('sends an already signed-in user to home instead of the sign-up form', () => {
    mockAuth.mockReturnValue({ session: {}, profile: profile(), loading: false });
    landsOn(<RedirectIfSignedIn><div>sign up form</div></RedirectIfSignedIn>);
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('resumes a half-onboarded user where they left off', () => {
    mockAuth.mockReturnValue({
      session: {}, profile: profile({ current_goal: null }), loading: false,
    });
    landsOn(<RedirectIfSignedIn><div>sign up form</div></RedirectIfSignedIn>);
    expect(screen.getByText('goal selection')).toBeInTheDocument();
  });
});
