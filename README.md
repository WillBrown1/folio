# Folio

Guitar practice journal at https://willbrown1.github.io/folio/.

## Practice

The main view is a song list. Empty circular buttons open a practice card. The large timer counts up for the current session; Today shows the total accumulated for that song on the local calendar day. The ring fills green toward the song's practice target, or the selected shared set's target. It stays full after reaching the target while the timer keeps recording.

Pause excludes elapsed time until resumed. Finish & save stops the session. Closing the card hides it without stopping; use the header's practice button or the song circle to reopen it. On mobile the card fills the screen. Timers recover after reload and split time at local midnight. They continue until paused or finished, including while the browser is closed. Keep the page open and device awake for the target chime.

The header contains a persistent light/dark theme toggle. Initial theme follows the device setting. All decorative messages and motivational copy have been removed.

## Songs and Focus

Add or edit songs, artists, BPM, practice minutes, lessons and notes. Song details include a calendar, totals, optional metronome with tempo ramps, manual confidence stars, and a Learning/Maintaining choice. Stars mean Starting, Building, Getting there, Solid and Ready; an unrated song starts at zero. Stars never automatically change its stage.

Focus replaces the weekly schedule. Choose up to three Learning songs and edit their practice targets. The daily Practice queue includes those songs plus at most two due Maintaining songs; all other songs remain available for extra practice. Completed maintenance songs keep their queue slots for the rest of that day. Existing scheduled songs are prioritized during the one-time migration, followed by recently practiced songs; confidence starts unrated. Original weekly schedules stay in backups for compatibility but no longer drive the queue.

Finishing a session offers optional Struggled / Okay / Comfortable feedback. Maintenance starts with a three-day interval. Struggled returns tomorrow; Okay uses a two-to-seven-day interval; Comfortable doubles the previous interval up to thirty days. Skipping feedback keeps the existing interval. Repeated feedback on the same calendar day does not repeatedly double the interval. Learning songs remain daily focus items regardless of feedback. Ratings, stages, focus choices and review dates sync privately with the account journal.

An email/password account is required. Songs, plans, lesson links, notes, BPM, metronome settings and practice history sync privately through Supabase. Each browser keeps an account-specific cache for connection interruptions. Sync runs after edits, every ten seconds, and when returning to the page. Check “Synced to your account” before switching devices. Timers belong to the device that started them; their recorded time syncs, while active timers do not start on other devices.

Sign-in uses Supabase's existing project storage key with local storage and an IndexedDB backup in the same browser. Refreshed sessions update both copies; explicit sign-out removes both. Returning to the page rechecks the saved session, and auth events are processed in order rather than dropped during journal loading. Sign out uses local scope so other devices retain their sessions. Private browsing, clearing all site data, and switching browser/app containers do not share this browser session.

Existing browser data imports once into the first account used on that browser; the original journal is retained locally. Songs are matched by ID or title/artist, schedules are combined, and overlapping historical totals use the larger value to avoid counting the same old session twice. Existing cloud notes take precedence when both copies contain notes. Export/import remains available for manual backups. The supplied 23 songs are the default for new accounts, with unset BPM and lessons and a ten-minute target.

Journal writes use revision checks and durable mutation IDs. Independent song-field and weekday edits merge, practice-time deltas add across devices, and retries are idempotent. For simultaneous edits to the same field or weekday, the device currently saving takes precedence. Raw journals, notes, lessons, confidence ratings and Focus settings remain private. Share practice exposes only the separately recorded shared sessions to accepted friends and set members. A separate Share repertoire & history opt-in also exposes a safe song catalog and daily historical totals to accepted friends; it requires Share practice to remain enabled.

Jam includes a daily leaderboard of the current account and accepted friends. Sharing-disabled people are shown without a rank. Shared sets default to All time and offer Today, 7 days and 30 days, with per-song combined totals, member totals and set totals. Historical shared records are aggregated on the server; today's live increments are overlaid without counting today's records twice. Clicking a person opens their repertoire and per-song daily history. Without the extra repertoire/history opt-in, only previously shared sessions appear. Unplayed songs appear when full repertoire sharing is enabled. Day lists load in blocks of thirty. The date periods use the displayed local calendar-date convention.

Song lessons can be added in Edit song. YouTube embedding depends on video-owner settings; each lesson includes an external YouTube link.

## Development

Jam shows online status and the active song when Share practice is enabled. Foreground clients send a heartbeat every five seconds; Supabase Realtime delivers live session, practice-record and sharing changes through the existing access policies. Visible counters tick once per second between updates. Pausing sends a new state; hiding a page sends offline when possible. Stale sessions expire after twenty seconds, and disconnected counters stop extrapolating. A fifteen-second snapshot poll provides recovery if the live connection drops. A Live label indicates an active Realtime subscription; Updating indicates snapshot fallback.

The live counter combines confirmed practice records with only the unconfirmed part of each stable session event. Multiple devices add distinct events, and duplicate events are counted once. Live estimates settle to the recorded duration when final uploads arrive. Full journals and notes are never replicated to friends.

Run `node build.cjs` after changing source modules or style.css. The generated bundle and hashed asset URLs are committed for static GitHub Pages hosting. Run `node serve.cjs` for local preview. Supabase configuration and setup are in `backend/SETUP.md`.

Tests: `node --test journal.test.mjs social.test.mjs cloud-journal.test.mjs account-gate.test.cjs live-practice.test.mjs focus.test.mjs auth-session.test.mjs jam-stats.test.mjs`. SQL authorization tests run inside rolled-back transactions; no test accounts remain and no emails are sent.

Local development uses the configured real account backend. Do not use production accounts for destructive testing.


Song cards now show the daily ring beside the title, stars, calendar, best attempt, and lesson. Extra settings are collapsed. Record audio in the browser or upload an audio file, preview it, then save privately or share with accepted friends. Limits: ten minutes and 20 MB. Microphone use requires browser permission. Shared attempts appear in the owner's Jam repertoire; private audio uses authenticated Storage downloads. Sharing is separate from practice/history sharing. JSON journal backups do not include audio recordings.

The Focus tab contains daily limit controls; Practice shows only the live daily progress bar. The limit is a recurring maximum in minutes, synced privately with the journal. Setting it divides remaining available time proportionally across focused/due songs (or the selected shared set), accounting for all practice already logged that day. Saved targets stay fixed while timers run; later days or changed queues refit to the limit. Normal song settings and shared-set targets are preserved. Reset returns to normal targets. The progress bar counts all of today's practice, including extra songs, against the lower of the limit and the full planned time (the limit itself when no queue exists). Timers continue beyond the limit. `practice-budget.test.mjs` covers allocation, existing time, midnight, set targets, validation and sync merging.

Current shared sets load automatically below Today's focus on Practice. Their songs are available without launching a set from Jam; missing songs are added without overwriting existing notes, lessons or song settings. The daily queue combines personal Focus songs and current sets, uses the largest target when a song appears more than once, and applies the daily target to that unique queue. Set edits and membership changes refresh in the background; leaving a set preserves songs and logged practice. Set membership snapshots remain in the account-specific device cache, while imported songs sync privately with the journal.
