# vote-checker

Vue 3 + TypeScript SPA for looking up phone numbers from a Supabase `votes`
table (Нишон тумани, Гулистон МФЙ). Debounced search, server-side pagination.

Deployed to GitHub Pages at `/vote-checker/`.

## Setup

```sh
npm install
cp .env.example .env   # fill in your Supabase project URL and anon key
npm run dev            # http://localhost:3000
```

Required environment variables:

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (publishable) key |
| `VITE_INITIATIVE_ID` | **Required.** `votes.initiative_id` this deployment shows |
| `VITE_INITIATIVE_NAME` | Optional. Subtitle shown in the header |

One deployment shows one initiative. `VITE_INITIATIVE_ID` filters every query;
there is no initiatives table to join against, so `VITE_INITIATIVE_NAME` supplies
the display name.

The anon key is bundled into the client, so **row-level security on the `votes`
table is the only thing restricting who can read it.** The current policy is
`using (true)`, meaning every initiative's phone numbers are readable by anyone
who opens devtools — the `VITE_INITIATIVE_ID` filter is presentation, not
access control. `db/auth.sql` closes this — see **Sign-in** below — and until it
has been run against your project, the deployment is world-readable.

### Restricting reads to one initiative

```sql
drop policy "Enable read access for all users" on votes;

create policy "anon reads one initiative"
on votes for select to anon
using (initiative_id = 'your-initiative-id');
```

Note this pins the database to a single initiative. If other consumers read the
same table, scope by role or move the site to a view instead.

## Sign-in

The site is behind Supabase Auth (email + password). `db/auth.sql` is the part
that matters: it revokes `anon` from `votes` entirely and re-grants reads to the
`authenticated` role, so an unauthenticated request gets nothing back even with
the bundled anon key in hand. The login page and the router guard are UX on top
of that — both ship in the bundle and neither can be relied on alone.

Setup, in order:

1. Supabase dashboard → **Authentication → Users → Add user**, for each person
   who should have access.
2. **Authentication → Providers → Email** → turn **off** "Enable sign ups".
   Left on, anyone can self-register into `authenticated` and read every row.
3. Run `db/auth.sql` in the SQL editor, replacing `<OURS>` with your
   `initiative_id`.
4. Verify from outside the browser — this must return `[]`:

   ```sh
   curl "$SUPABASE_URL/rest/v1/votes?select=phone_number&limit=1"      -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
   ```

Sessions persist in `localStorage` and refresh automatically, so a reader signs
in once per browser. There is no password reset flow in the app; reset from the
dashboard.

## Commands

```sh
npm run dev         # dev server
npm run build       # type-check + production build
npm run build-only  # production build, no type-check
npm run type-check  # vue-tsc only
npm run preview     # preview production build
npm run deploy      # build + publish dist/ to GitHub Pages
```

No test runner is configured.

## Notes

- Routing uses HTML5 history (clean URLs). GitHub Pages has no SPA rewrite, so
  the build copies `dist/index.html` to `dist/404.html`; GH Pages serves it for
  unknown paths and the router resolves them client-side. Deep links work, but
  the initial response carries HTTP 404 — harmless for users, visible to crawlers.
- `@` is a path alias for `src/`.
- Phone numbers are assumed to be stored as dash-separated digit pairs
  (`90-12-34-56`); search builds both digit alignments to match substrings.
