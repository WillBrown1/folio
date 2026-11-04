# repertoire

Guitar practice journal at https://willbrown1.github.io/stillblade/.

## Practice

The main view is a song list. Empty circular buttons open a practice card. The large timer counts up for the current session; Today shows the total accumulated for that song on the local calendar day. The ring fills green toward the scheduled daily target, or the song's default practice duration when unscheduled. It stays full after reaching the target while the timer keeps recording.

Pause excludes elapsed time until resumed. Finish & save stops the session. Closing the card hides it without stopping; use the header's practice button or the song circle to reopen it. On mobile the card fills the screen. Timers recover after reload and split time at local midnight. They continue until paused or finished, including while the browser is closed. Keep the page open and device awake for the target chime.

The header contains a persistent light/dark theme toggle. Initial theme follows the device setting. All decorative messages and motivational copy have been removed.

## Songs and schedules

Add or edit songs, artists, BPM, default minutes, lessons and notes. Song details include a calendar, totals and an optional metronome with tempo ramps. The weekly schedule assigns songs and durations to each day. All time on a song counts toward the day's target, including extra sessions.

An email/password account is required. Songs, plans, lesson links, notes, BPM, metronome settings and practice history sync privately through Supabase. Each browser keeps an account-specific cache for connection interruptions. Sync runs after edits, every ten seconds, and when returning to the page. Check “Synced to your account” before switching devices. Timers belong to the device that started them; their recorded time syncs, while active timers do not start on other devices.

Existing browser data imports once into the first account used on that browser; the original journal is retained locally. Songs are matched by ID or title/artist, schedules are combined, and overlapping historical totals use the larger value to avoid counting the same old session twice. Existing cloud notes take precedence when both copies contain notes. Export/import remains available for manual backups. The supplied 23 songs are the default for new accounts, with unset BPM and lessons and a ten-minute target.

Journal writes use revision checks and durable mutation IDs. Independent song-field and weekday edits merge, practice-time deltas add across devices, and retries are idempotent. For simultaneous edits to the same field or weekday, the device currently saving takes precedence. Full journals are private even when practice sharing is enabled; only the separately opted-in practice events are visible to friends and set members.

Song lessons can be added in Edit song. YouTube embedding depends on video-owner settings; each lesson includes an external YouTube link.

## Development

Jam shows online status and the active song when Share practice is enabled. Foreground clients send a heartbeat every five seconds; Supabase Realtime delivers live session, practice-record and sharing changes through the existing access policies. Visible counters tick once per second between updates. Pausing sends a new state; hiding a page sends offline when possible. Stale sessions expire after twenty seconds, and disconnected counters stop extrapolating. A fifteen-second snapshot poll provides recovery if the live connection drops. A Live label indicates an active Realtime subscription; Updating indicates snapshot fallback.

The live counter combines confirmed practice records with only the unconfirmed part of each stable session event. Multiple devices add distinct events, and duplicate events are counted once. Live estimates settle to the recorded duration when final uploads arrive. Full journals and notes are never replicated to friends.

Run `node build.cjs` after changing source modules or style.css. The generated bundle and hashed asset URLs are committed for static GitHub Pages hosting. Run `node serve.cjs` for local preview. Supabase configuration and setup are in `backend/SETUP.md`.

Tests: `node --test journal.test.mjs social.test.mjs cloud-journal.test.mjs account-gate.test.cjs live-practice.test.mjs`. SQL authorization tests run inside rolled-back transactions; no test accounts remain and no emails are sent.

Local development uses the configured real account backend. Do not use production accounts for destructive testing.

