-- Stats page: aggregate views + RLS lockdown.
-- Run in the Supabase SQL editor. Replace <OURS> with your initiative_id.
--
-- Why views: PostgREST has no GROUP BY, so the alternative is downloading every
-- vote row to the browser to count them. These views keep phone numbers in the
-- database and return a few hundred rows instead of tens of thousands.
--
-- Views run with security_invoker = off, meaning they execute as the owner and
-- bypass RLS on `votes`. That is deliberate: raw rows get locked to one
-- initiative below, while aggregate counts stay public for every initiative.

-- ---------------------------------------------------------------------------
-- 1. Per-hour counts. Powers the time-series line chart and the rate bars.
--
--    Hourly, not daily: the campaign so far spans ~4 days, which would give a
--    4-point line. The client rolls hours up to days when the range gets wide
--    enough to warrant it.
-- ---------------------------------------------------------------------------
create or replace view vote_stats_hourly as
select
  initiative_id,
  date_trunc('hour', vote_date) as hour,
  count(*) as votes
from votes
group by 1, 2;

alter view vote_stats_hourly set (security_invoker = off);
grant select on vote_stats_hourly to anon;

-- ---------------------------------------------------------------------------
-- 2. Per-initiative totals. Powers the ranking bars and the "last updated" stamp.
-- ---------------------------------------------------------------------------
create or replace view vote_stats_totals as
select
  initiative_id,
  count(*) as votes,
  min(vote_date) as first_vote,
  max(vote_date) as last_vote
from votes
group by 1;

alter view vote_stats_totals set (security_invoker = off);
grant select on vote_stats_totals to anon;

-- ---------------------------------------------------------------------------
-- 3. Initiative labels + scrape completeness.
--
--    scrape_state is the only source of human-readable names (initiative_id is
--    a bare UUID). It also carries the true totals: `votes` holds only what the
--    scraper has collected so far, so count(*) understates any initiative whose
--    is_initial_done is false. The stats page needs both numbers to avoid
--    presenting a partial load as a final result.
--
--    Exposed as a view rather than granting scrape_state itself, so scraper
--    internals (frozen_until, current_page, catchup_*) stay private.
-- ---------------------------------------------------------------------------
create or replace view initiative_info as
select
  initiative_id,
  label,
  total_elements,
  is_initial_done,
  last_scraped_at
from scrape_state;

alter view initiative_info set (security_invoker = off);
grant select on initiative_info to anon;

-- Check that scrape_state itself is not anon-readable. If RLS is not enabled on
-- it, the default grants may expose every column:
--   select relname, relrowsecurity from pg_class where relname = 'scrape_state';
--   alter table scrape_state enable row level security;   -- if it is not already

-- ---------------------------------------------------------------------------
-- 4. Lock raw vote rows to our initiative.
--    After this, the Рақамлар page still works (it filters by the same id) but
--    other initiatives' phone numbers are no longer downloadable via the anon
--    key. The stats views above are unaffected.
-- ---------------------------------------------------------------------------
drop policy if exists "Enable read access for all users" on votes;

create policy "anon reads own initiative"
on votes for select to anon
using (initiative_id = '<OURS>');

-- Sibling tables carry the same wide-open policy; lock or drop them too if the
-- app does not read them.
--   votes_origin
--   votes_2026_1

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
-- select * from vote_stats_totals order by votes desc;
-- select * from vote_stats_hourly order by hour desc limit 20;
-- select * from initiative_info;
-- select tablename, policyname, cmd, qual from pg_policies where schemaname = 'public';
