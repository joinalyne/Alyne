-- ============================================================================
-- Alyne — pair retention: how many pairs are actually keeping each other honest
--
-- Salomeh's stated measure for the first Reddit ad test (Sept 2026): "pairs
-- where both people check in on day two". Paste into the Supabase SQL editor.
--
-- Deliberately SQL rather than PostHog. PostHog counts people, and this is a
-- property of a PAIR: it needs to know who is matched with whom, which only the
-- database knows. Instrumenting it as an event would mean shipping the pairing
-- into the analytics tool to answer a question Postgres already answers exactly.
--
-- It also avoids a trap in the obvious version. Anchoring on "day one = the day
-- the match was created" makes the first day a partial one, so a pair matched at
-- 21:00 looks like a day-one failure for no reason but the hour. Both live pairs
-- score zero on that definition and two on this one. So this counts MUTUAL DAYS:
-- distinct local dates on which BOTH partners checked in, which needs no anchor
-- and cannot be gamed by the clock.
--
-- Caveat worth knowing: partners in different timezones can record the same
-- evening as two different local dates, so a cross-timezone pair can read one
-- mutual day light. Immaterial for a US and Canada test, wrong for a global one.
-- ============================================================================

with pair as (
  select m.id as match_id, m.goal, m.status, m.created_at,
         m.user_a, m.user_b,
         coalesce(pa.display_name, pa.email) as person_a,
         coalesce(pb.display_name, pb.email) as person_b
  from public.matches m
  join public.profiles pa on pa.id = m.user_a
  join public.profiles pb on pb.id = m.user_b
  -- Fixtures and demo accounts would flatter every number here.
  where pa.email not like '%@test.alyne' and pb.email not like '%@test.alyne'
    and pa.email not like '%@demo.alyne' and pb.email not like '%@demo.alyne'
),
mutual as (
  select p.match_id,
         count(*) as mutual_days
  from pair p
  join public.check_ins ca on ca.user_id = p.user_a
  join public.check_ins cb on cb.user_id = p.user_b
                          and cb.local_date = ca.local_date
  group by p.match_id
),
solo as (
  select p.match_id,
         (select count(*) from public.check_ins c where c.user_id = p.user_a) as days_a,
         (select count(*) from public.check_ins c where c.user_id = p.user_b) as days_b
  from pair p
)
select p.goal,
       p.status,
       p.created_at::date       as matched_on,
       p.person_a, s.days_a,
       p.person_b, s.days_b,
       coalesce(m.mutual_days, 0) as mutual_days,
       -- The headline: a pair that managed it twice is a pair with a habit,
       -- rather than two people who both happened to turn up on day one.
       case
         when coalesce(m.mutual_days, 0) >= 2 then 'holding'
         when coalesce(m.mutual_days, 0) = 1  then 'started'
         when s.days_a > 0 or s.days_b > 0    then 'one-sided'
         else 'never started'
       end as verdict
from pair p
left join mutual m on m.match_id = p.match_id
left join solo   s on s.match_id = p.match_id
order by mutual_days desc, matched_on desc;
