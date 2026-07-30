-- ============================================================================
-- Alyne — 0016: return avatars from claim_match_email
--
-- v5 of the match template replaced the glyph fallback with an initials circle,
-- which means the sender has to know whether each person actually has a photo.
-- claim_match_email() returned names and emails but not avatars, so every email
-- would have shown initials even for users who had uploaded a picture.
--
-- Signature change only; the claim logic and its exactly-once guarantee are
-- untouched. Dropped first because the return type changes, which CREATE OR
-- REPLACE cannot do.
-- ============================================================================

begin;

drop function if exists public.claim_match_email(uuid);

create or replace function public.claim_match_email(p_match_id uuid)
returns table (
  match_id      uuid,
  goal          text,
  user_a_name   text,
  user_a_email  text,
  user_a_avatar text,
  user_b_name   text,
  user_b_email  text,
  user_b_avatar text
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

  -- The conditional UPDATE is the whole idempotency guarantee: if both partners
  -- hit the endpoint at once, exactly one matches a row.
  update public.matches m
  set    match_email_sent_at = now()
  where  m.id = p_match_id
    and  m.status = 'active'
    and  m.match_email_sent_at is null
    and  (m.user_a = auth.uid() or m.user_b = auth.uid())
  returning m.* into claimed;

  if claimed.id is null then
    return;  -- already sent, not a participant, or no such active match
  end if;

  return query
  select claimed.id,
         claimed.goal::text,
         a.display_name, a.email, a.avatar_url,
         b.display_name, b.email, b.avatar_url
  from   public.profiles a, public.profiles b
  where  a.id = claimed.user_a and b.id = claimed.user_b;
end;
$$;

revoke all on function public.claim_match_email(uuid) from public;
grant execute on function public.claim_match_email(uuid) to authenticated;

commit;
