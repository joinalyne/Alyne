-- ============================================================================
-- Alyne — M1 migration 0005: match-notification bookkeeping
--
-- The match email has to be sent exactly once per pairing, to both people.
--
-- Who triggers it is the awkward part. Matches are created inside
-- enqueue_and_match(), which is a Postgres function with no outbound network
-- access. The obvious answer — have the client that created the match call the
-- send endpoint — loses the email if that browser closes first.
--
-- So instead BOTH clients call the endpoint when they land on /matched, and
-- this column makes that safe: the first call stamps it and sends, the second
-- sees the stamp and does nothing. Two chances to send, exactly one email.
-- ============================================================================

begin;

alter table public.matches
  add column if not exists match_email_sent_at timestamptz;

comment on column public.matches.match_email_sent_at is
  'Set by the send-match-email function. Non-null means both users have been '
  'notified; the endpoint is a no-op thereafter.';

-- Claim the right to send, atomically.
--
-- `where match_email_sent_at is null` inside a single UPDATE is what makes this
-- safe under concurrency: if both partners hit the endpoint in the same
-- instant, exactly one UPDATE matches a row and the other returns nothing.
-- Doing it as a read-then-write in the API function would race and send twice.
create or replace function public.claim_match_email(p_match_id uuid)
returns table (
  match_id     uuid,
  goal         text,
  user_a_name  text,
  user_a_email text,
  user_b_name  text,
  user_b_email text
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  claimed public.matches;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.matches m
  set    match_email_sent_at = now()
  where  m.id = p_match_id
    and  m.status = 'active'
    and  m.match_email_sent_at is null
    -- Only a participant may trigger their own pairing's email.
    and  (m.user_a = auth.uid() or m.user_b = auth.uid())
  returning m.* into claimed;

  if claimed.id is null then
    return;  -- already sent, not a participant, or no such active match
  end if;

  return query
  select claimed.id,
         claimed.goal::text,
         a.display_name, a.email,
         b.display_name, b.email
  from   public.profiles a, public.profiles b
  where  a.id = claimed.user_a and b.id = claimed.user_b;
end;
$$;

revoke all on function public.claim_match_email(uuid) from public;
grant execute on function public.claim_match_email(uuid) to authenticated;

-- Release the claim so a later attempt can retry, used when Resend fails.
create or replace function public.release_match_email(p_match_id uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.matches
  set    match_email_sent_at = null
  where  id = p_match_id
    and  (user_a = auth.uid() or user_b = auth.uid());
$$;

revoke all on function public.release_match_email(uuid) from public;
grant execute on function public.release_match_email(uuid) to authenticated;

commit;
