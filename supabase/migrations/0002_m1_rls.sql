-- ============================================================================
-- Alyne — M1 migration 0002: row-level security
--
-- The live database currently allows a user to read only their OWN profile and
-- check-ins, which makes the two-player product impossible: Home and Matched
-- have to show a partner's name, streak and latest check-in. This migration
-- opens exactly that much and no more, gated on an ACTIVE match.
--
-- Design note — why the helpers are `security definer`:
-- an RLS policy on `profiles` that reads `profiles` (to check is_admin) makes
-- Postgres re-evaluate the policy for every nested read until it raises
-- `stack depth limit exceeded` (SQLSTATE 54001). Same trap for a policy that
-- reads `matches`. Both helpers below therefore run as the owner, bypassing
-- RLS for their own internal reads. They return booleans only — never row
-- data — so they cannot leak anything the caller could not already infer.
-- `set search_path = public` defeats search-path attacks.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

comment on function public.is_admin() is
  'True if the caller is an admin. Security definer to avoid RLS recursion on profiles.';

create or replace function public.shares_active_match(other_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.matches m
    where m.status = 'active'
      and (   (m.user_a = auth.uid() and m.user_b = other_id)
           or (m.user_b = auth.uid() and m.user_a = other_id))
  );
$$;

comment on function public.shares_active_match(uuid) is
  'True if the caller and other_id are currently matched. Security definer to avoid RLS recursion.';

-- Storage-path variant. Takes the folder segment as text and casts defensively:
-- a non-uuid folder name must return false, not abort the policy with a cast
-- error. Postgres does not guarantee AND short-circuits, so the guard cannot
-- live in the policy expression.
create or replace function public.shares_active_match_path(folder text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  other uuid;
begin
  begin
    other := folder::uuid;
  exception when others then
    return false;
  end;
  return exists (
    select 1 from public.matches m
    where m.status = 'active'
      and (   (m.user_a = auth.uid() and m.user_b = other)
           or (m.user_b = auth.uid() and m.user_a = other))
  );
end;
$$;

grant execute on function public.is_admin()                    to authenticated;
grant execute on function public.shares_active_match(uuid)     to authenticated;
grant execute on function public.shares_active_match_path(text) to authenticated;


-- ---------------------------------------------------------------------------
-- 2. profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- The May policies survived the column rename (Postgres rewrites policy
-- expressions when a column is renamed), but they are own-rows-only. Replace.
drop policy if exists "Users can read own profile"   on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can upsert own profile" on public.profiles;

create policy "profiles: read own, partner, or admin"
  on public.profiles for select
  using (
    auth.uid() = id
    or public.shares_active_match(id)
    or public.is_admin()
  );

create policy "profiles: insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No delete policy: profiles are removed by the cascade from auth.users.


-- ---------------------------------------------------------------------------
-- 3. matches
-- ---------------------------------------------------------------------------
alter table public.matches enable row level security;

create policy "matches: read own or admin"
  on public.matches for select
  using (auth.uid() = user_a or auth.uid() = user_b or public.is_admin());

-- Unmatch is admin-controlled by product decision — no self-serve UI.
create policy "matches: admin may end"
  on public.matches for update
  using (public.is_admin())
  with check (public.is_admin());

-- No insert policy. Matches are created ONLY by the engine in 0003, which is
-- security definer. A client cannot pair itself with anyone.


-- ---------------------------------------------------------------------------
-- 4. match_queue
-- ---------------------------------------------------------------------------
alter table public.match_queue enable row level security;

create policy "queue: read own or admin"
  on public.match_queue for select
  using (auth.uid() = user_id or public.is_admin());

-- No insert/update/delete policies. Enqueueing goes through the engine so that
-- `priority` is derived from profiles.plan server-side; if clients could write
-- here, any free user could award themselves paid priority rematch.


-- ---------------------------------------------------------------------------
-- 5. check_ins
-- ---------------------------------------------------------------------------
alter table public.check_ins enable row level security;

create policy "check_ins: read own, partner, or admin"
  on public.check_ins for select
  using (
    auth.uid() = user_id
    or public.shares_active_match(user_id)
    or public.is_admin()
  );

create policy "check_ins: insert own"
  on public.check_ins for insert
  with check (auth.uid() = user_id);

-- No update or delete: check-ins are an append-only log. The one-per-day
-- unique constraint is the guard against a user rewriting history to inflate
-- a streak, and it only holds if rows are immutable.


-- ---------------------------------------------------------------------------
-- 6. messages (table exists per the proposal; no UI in M1-M4)
-- ---------------------------------------------------------------------------
alter table public.messages enable row level security;

create policy "messages: read own match"
  on public.messages for select
  using (
    exists (
      select 1 from public.matches m
      where m.id = messages.match_id
        and (m.user_a = auth.uid() or m.user_b = auth.uid())
    )
    or public.is_admin()
  );

create policy "messages: send as self into own match"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = messages.match_id
        and m.status = 'active'
        and (m.user_a = auth.uid() or m.user_b = auth.uid())
    )
  );


-- ---------------------------------------------------------------------------
-- 7. Legacy table — lock it down
-- ---------------------------------------------------------------------------
alter table public.checkins_legacy_20260727 enable row level security;
drop policy if exists "Users can insert own checkins" on public.checkins_legacy_20260727;
drop policy if exists "Users can read own checkins"   on public.checkins_legacy_20260727;
-- No policies at all: readable only via the service role. It is an archive.


-- ---------------------------------------------------------------------------
-- 8. Storage
--
-- Path convention is `{user_id}/{filename}`, matching the existing
-- uploadAvatar() in src/lib/supabase.ts.
-- ---------------------------------------------------------------------------

drop policy if exists "avatars: public read"        on storage.objects;
drop policy if exists "avatars: write own folder"   on storage.objects;
drop policy if exists "avatars: update own folder"  on storage.objects;
drop policy if exists "check-ins: read own or partner" on storage.objects;
drop policy if exists "check-ins: write own folder" on storage.objects;

-- avatars is a public bucket, so reads are served by the CDN regardless; this
-- policy covers authenticated API reads.
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars: write own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: update own folder"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- check-ins is private: photo and voice media is readable by the owner and,
-- while matched, their partner.
create policy "check-ins: read own or partner"
  on storage.objects for select
  using (
    bucket_id = 'check-ins'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.shares_active_match_path((storage.foldername(name))[1])
      or public.is_admin()
    )
  );

create policy "check-ins: write own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'check-ins'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
