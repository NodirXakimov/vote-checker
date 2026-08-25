-- Site visit counter: insert-only log table + aggregate view.
-- Run in the Supabase SQL editor, after db/stats.sql.
--
-- Why a table and not a third-party analytics script: the count needs to render
-- inside /stats next to the vote numbers, which means it has to be readable
-- from our own database. It also keeps the site free of external trackers —
-- this app already displays real phone numbers, so adding a third party that
-- sees the URLs those numbers appear under would be a step backwards.
--
-- No IP address and no user agent are stored, only a random client-generated
-- session id. Nothing here identifies a person.

-- ---------------------------------------------------------------------------
-- 1. The log table.
--
--    session_id is a uuid the browser generates and keeps in localStorage, so
--    repeat views from one browser collapse into one "visitor". It is opaque
--    and unlinkable to anything else.
-- ---------------------------------------------------------------------------
create table if not exists page_views (
  id bigserial primary key,
  initiative_id text not null,
  path text not null,
  session_id text,
  created_at timestamptz not null default now()
);

create index if not exists page_views_initiative_created_idx
  on page_views (initiative_id, created_at);

-- ---------------------------------------------------------------------------
-- 2. Lock it down.
--
--    Supabase grants anon every privilege on new public tables by default, so
--    RLS alone is not enough: TRUNCATE ignores RLS entirely. Revoke first, then
--    grant back only INSERT. The sequence grant is required or inserts fail
--    with "permission denied for sequence page_views_id_seq".
--
--    With no SELECT policy, anon cannot read rows back even though it writes
--    them. That is intended — the aggregate view below is the only read path.
-- ---------------------------------------------------------------------------
alter table page_views enable row level security;

revoke all on page_views from anon;
grant insert on page_views to anon;
grant usage on sequence page_views_id_seq to anon;

drop policy if exists anon_insert on page_views;
create policy anon_insert on page_views for insert to anon with check (true);

-- ---------------------------------------------------------------------------
-- 3. Hourly aggregate. Same shape and same reasoning as vote_stats_hourly:
--    PostgREST has no GROUP BY, and the raw rows must stay unreadable.
--
--    security_invoker = off is load-bearing. With it on, the view would execute
--    as the anon caller, hit the RLS policy above (which grants no SELECT) and
--    return zero rows — a silent 0 on the stats page, not an error.
-- ---------------------------------------------------------------------------
create or replace view visit_stats as
select
  initiative_id,
  date_trunc('hour', created_at) as hour,
  count(*) as views,
  count(distinct session_id) as visitors
from page_views
group by 1, 2;

alter view visit_stats set (security_invoker = off);

revoke all on visit_stats from anon;
grant select on visit_stats to anon;

-- ---------------------------------------------------------------------------
-- Caveat: anon can insert freely, so the counts are inflatable by anyone who
-- reads the bundled anon key. They are a public vanity metric, not an audited
-- figure. Do not use them for anything that matters.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
-- select relrowsecurity from pg_class where relname = 'page_views';   -- expect t
-- select privilege_type from information_schema.role_table_grants
--   where table_name = 'page_views' and grantee = 'anon';             -- expect INSERT only
-- select * from visit_stats order by hour desc limit 20;
