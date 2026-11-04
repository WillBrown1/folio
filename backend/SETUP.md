# Shared practice backend

The GitHub Pages frontend uses Supabase Auth and PostgreSQL. `social-config.json` contains only the project URL and public publishable key. Never add a secret/service-role key or database password to the repository.

1. Create a personal Supabase project on the free plan.
2. Run `backend/social-schema.sql` once in its SQL editor. The transaction creates only `repertoire_*` tables and a dedicated private helper schema. All data tables use Row Level Security.
   Then run `backend/account-sync.sql` once to add private full-journal storage and revision-checked, idempotent saves. Run `backend/account-sync-test.sql` to verify owner-only access, anonymous denial, conflict protection and retry behavior inside a rolled-back transaction.
   Run `backend/live-practice.sql` once for live Jam status. It adds a protected heartbeat table and RPCs, and enables Realtime replication only for live sessions, shared practice records and public-facing profiles. Full journal documents are not published. Run `backend/live-practice-test.sql` to verify friend consent, set membership, sharing opt-out, owner identity, and anonymous denial.
   Run `backend/jam-history.sql` for multi-day set aggregates and the opt-in friend repertoire/history projection. `share_repertoire` defaults to false. `backend/jam-history-test.sql` verifies accepted-friend consent, both sharing switches, exclusion of private fields, raw-journal denial, set-only limits, date aggregates and anonymous denial.
3. Configure Auth → URL Configuration with site URL `https://willbrown1.github.io/folio/` and redirect URL `https://willbrown1.github.io/folio/?view=friends` for the Friends view and invitation links. Enable email sign-in. Configure custom SMTP for confirmation and password recovery emails to people outside the Supabase organization. The default sender is restricted to organization members. Keep email confirmation enabled unless the project owner explicitly chooses unverified email/password signup.
4. Put the project URL and publishable/anon key into `social-config.json`.
5. Run `node build.cjs`, the journal/social tests, and publish. Test two real accounts for mutual friendship and set membership before declaring the shared backend verified.

## Behavior

- Current project setting: email confirmation is disabled with the owner's approval. Email/password accounts can sign up immediately. Email ownership is not verified; email password recovery requires a custom SMTP provider.
- People create an account with email, password and a display name, then sign in with email and password. Passwords are handled by Supabase Auth and are never stored in the journal. Email addresses are not exposed to friends.
- Friend codes create pending requests. Only the recipient can accept. Either endpoint can decline, cancel or remove the relationship.
- Practice sharing is opt-in. Only new practice recorded while sharing is enabled is uploaded. Private notes and preexisting journal history are not uploaded. Disabling sharing hides existing shared times from other members.
- The same sharing setting controls live online status and active-song information. Heartbeats are sent every five seconds while enabled; the UI marks stale sessions offline after twenty seconds. Live previews are bounded and are reconciled with durable per-session records without double-counting. Background pages send offline and stop showing an active live counter.
- Each session/day has a stable event ID. Uploads are cumulative and idempotent; retries and out-of-order delivery do not duplicate time. Sessions from separate devices add together. Pending events are retained locally until acknowledged.
- Friends appear in a daily leaderboard with the signed-in account. Set members see per-song combined and individual totals over Today, 7 days, 30 days or All time. A person who disabled sharing is labeled `Not sharing` and remains unranked.
- Friend profiles show shared sessions by default. With both sharing switches enabled, accepted friends can also see the owner's song titles, artists, BPM and daily history, including previous local practice already synced to the account. The projection never returns notes, lesson links, raw journal documents, confidence ratings, Focus settings, schedules, emails or credentials. Sharing a set alone does not grant full repertoire access.
- Owners can create, edit or delete sets. Members join through an invitation link/code and may leave. Anyone with an invitation and a signed-in account can join; only current members can read set details and its practice matrix.
- Practice set imports missing songs into the local repertoire without overwriting notes or custom settings. Daily set targets temporarily override the normal targets until the person exits the set or selects the Practice tab.
- Full journals sync privately to each account, independently of the Share practice setting. Account-specific browser caches retain pending edits; old browser data imports once into the first account used on that browser and stays intact as a local backup. Active timers and pending social uploads stay device-local. The shared date is a local calendar-date label, displayed explicitly in the UI; it is not a rolling 24-hour period.

## Verification

`social.test.mjs` covers canonical song matching, durable upload queues, retry acknowledgment, account isolation, accumulated time, and set import. `backend/authorization-test.sql` runs database-level authorization checks inside a rolled-back transaction, using test users with `.invalid` addresses and no email delivery.

## Best attempts

Run `backend/best-attempts.sql` once after the existing migrations, then `backend/best-attempts-test.sql`. The latter rolls back all fixtures. The private `repertoire-attempts` Storage bucket enforces owner uploads and owner/explicitly-shared accepted-friend reads. Metadata is keyed by stable journal song ID and saved through an authenticated RPC. Set membership alone grants no audio access. Replacement uploads use immutable paths and delete the previous object only after metadata commits. Run `node --test best-attempts.test.mjs` for recorder lifecycle, preview, retry, validation and card layout checks. Real hardware microphone capture remains a manual browser check.

## Song exchange

Run `backend/song-sharing.sql` once and `backend/song-sharing-test.sql` for rolled-back authorization fixtures. `repertoire_song_shares` stores explicit per-recipient song snapshots. Only the sender and recipient, while still accepted friends, can read them; only the sender can create/update a snapshot. Set-only membership grants no access. Removing friendship hides the snapshot; already imported copies remain the recipient’s journal data. Notes/lessons in the full-journal projection remain excluded. Matching friend recordings use the existing attempt metadata/Storage RLS without widening audio access. No new real-time publication is enabled; shares refresh through the normal visible-page poll.
