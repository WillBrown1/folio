# Shared practice backend

The GitHub Pages frontend uses Supabase Auth and PostgreSQL. `social-config.json` contains only the project URL and public publishable key. Never add a secret/service-role key or database password to the repository.

1. Create a personal Supabase project on the free plan.
2. Run `backend/social-schema.sql` once in its SQL editor. The transaction creates only `repertoire_*` tables and a dedicated private helper schema. All data tables use Row Level Security.
3. Configure Auth → URL Configuration with site URL `https://willbrown1.github.io/stillblade/` and redirect URL `https://willbrown1.github.io/stillblade/?view=friends` for the Friends view and invitation links. Enable email sign-in. Configure custom SMTP for confirmation and password recovery emails to people outside the Supabase organization. The default sender is restricted to organization members. Keep email confirmation enabled unless the project owner explicitly chooses unverified email/password signup.
4. Put the project URL and publishable/anon key into `social-config.json`.
5. Run `node build.cjs`, the journal/social tests, and publish. Test two real accounts for mutual friendship and set membership before declaring the shared backend verified.

## Behavior

- People create an account with email, password and a display name, then sign in with email and password. Passwords are handled by Supabase Auth and are never stored in the journal. Email addresses are not exposed to friends.
- Friend codes create pending requests. Only the recipient can accept. Either endpoint can decline, cancel or remove the relationship.
- Practice sharing is opt-in. Only new practice recorded while sharing is enabled is uploaded. Private notes and preexisting journal history are not uploaded. Disabling sharing hides existing shared times from other members.
- Each session/day has a stable event ID. Uploads are cumulative and idempotent; retries and out-of-order delivery do not duplicate time. Sessions from separate devices add together. Pending events are retained locally until acknowledged.
- Friends see accepted friends' shared daily totals. Set members see each member's per-song times, progress toward the common target, and set totals for the displayed date. A person who disabled sharing is labeled `Not sharing` rather than zero.
- Owners can create, edit or delete sets. Members join through an invitation link/code and may leave. Anyone with an invitation and a signed-in account can join; only current members can read set details and its practice matrix.
- Practice set imports missing songs into the local repertoire without overwriting notes or custom settings. Daily set targets temporarily override the normal targets until the person exits the set or selects the Practice tab.
- Personal journals remain browser-local. Only shared practice events, profiles, friendships, set definitions and memberships are stored remotely. The shared date is a local calendar-date label, displayed explicitly in the UI; it is not a rolling 24-hour period.

## Verification

`social.test.mjs` covers canonical song matching, durable upload queues, retry acknowledgment, account isolation, accumulated time, and set import. `backend/authorization-test.sql` runs database-level authorization checks inside a rolled-back transaction, using test users with `.invalid` addresses and no email delivery.
