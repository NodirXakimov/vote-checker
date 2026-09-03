-- Sign-in gate: move raw vote rows from `anon` to `authenticated`.
-- Run in the Supabase SQL editor, after db/stats.sql and db/visits.sql.
--
-- This file, not the login page, is the access control. The anon key ships in
-- the client bundle and the router guard lives in that same bundle, so both are
-- editable by anyone who opens devtools. What they cannot edit is which role
-- their JWT carries: without a valid session Supabase signs requests as `anon`,
-- and after this runs `anon` has no read path to `votes` at all.
--
-- Before running it, create the accounts that should have access:
--   Supabase dashboard -> Authentication -> Users -> Add user
-- and turn OFF Authentication -> Providers -> Email -> "Enable sign ups", or
-- anyone can self-register into the `authenticated` role and read everything.

-- ---------------------------------------------------------------------------
-- 1. Raw vote rows: authenticated only.
--
--    db/stats.sql left an `anon` policy scoped to one initiative. Drop it and
--    revoke the table grant as well — RLS filters rows, grants decide whether
--    the role may touch the table at all, and both should say no.
--
--    The initiative filter is kept in the policy so a signed-in reader still
--    only sees this deployment's rows, matching what the UI queries.
-- ---------------------------------------------------------------------------
drop policy if exists "Enable read access for all users" on votes;
drop policy if exists "anon reads own initiative" on votes;

revoke all on votes from anon;

create policy "authenticated reads own initiative"
on votes for select to authenticated
using (initiative_id = '<OURS>');

grant select on votes to authenticated;

-- Same treatment for the siblings, which carry the original wide-open policy.
-- The app never reads them; they are anon-readable purely by default.
revoke all on votes_origin from anon;
revoke all on votes_2026_1 from anon;

-- ---------------------------------------------------------------------------
-- 2. Re-grant the aggregate views to `authenticated`.
--
--    Easy to miss: `authenticated` does not inherit `anon`'s grants. They are
--    separate roles, so a view granted only to anon starts returning
--    "permission denied for view ..." the moment a user signs in — the stats
--    page breaks *because* auth was added.
--
--    The anon grants stay in place on purpose. These views expose counts only,
--    never a phone number, and db/stats.sql documents keeping aggregates public
--    across initiatives. Revoke them too if the whole site must be private.
-- ---------------------------------------------------------------------------
grant select on vote_stats_hourly to authenticated;
grant select on vote_stats_totals to authenticated;
grant select on initiative_info   to authenticated;
grant select on visit_stats       to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Page views: let signed-in readers log a view too.
--
--    Without this, trackView() silently fails for exactly the people who can
--    use the site (it swallows errors by design) and the traffic card flatlines.
--    The sequence grant is required here for the same reason as in visits.sql.
-- ---------------------------------------------------------------------------
grant insert on page_views to authenticated;
grant usage on sequence page_views_id_seq to authenticated;

drop policy if exists authenticated_insert on page_views;
create policy authenticated_insert on page_views
  for insert to authenticated with check (true);

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
-- Expect no rows: anon has no grant on votes any more.
-- select privilege_type from information_schema.role_table_grants
--   where table_name = 'votes' and grantee = 'anon';
--
-- Expect the authenticated policy only.
-- select policyname, roles, cmd, qual from pg_policies where tablename = 'votes';
--
-- Hard check from outside the browser — should return an empty array, not rows:
--   curl "$SUPABASE_URL/rest/v1/votes?select=phone_number&limit=1" \
--     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
