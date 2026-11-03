# repertoire

Guitar practice journal at https://willbrown1.github.io/stillblade/.

## Practice

The main view is a song list. Empty circular buttons open a practice card. The large timer counts up for the current session; Today shows the total accumulated for that song on the local calendar day. The ring fills green toward the scheduled daily target, or the song's default practice duration when unscheduled. It stays full after reaching the target while the timer keeps recording.

Pause excludes elapsed time until resumed. Finish & save stops the session. Closing the card hides it without stopping; use the header's practice button or the song circle to reopen it. On mobile the card fills the screen. Timers recover after reload and split time at local midnight. They continue until paused or finished, including while the browser is closed. Keep the page open and device awake for the target chime.

The header contains a persistent light/dark theme toggle. Initial theme follows the device setting. All decorative messages and motivational copy have been removed.

## Songs and schedules

Add or edit songs, artists, BPM, default minutes, lessons and notes. Song details include a calendar, totals and an optional metronome with tempo ramps. The weekly schedule assigns songs and durations to each day. All time on a song counts toward the day's target, including extra sessions.

Songs, plans, notes and history are stored in the current browser/device without an account or server sync. Export/import a JSON backup to transfer data. Clearing browser data removes the journal. Sample songs may be edited or removed. Only source files are deployed to GitHub.

Starter lesson links: [Blackbird](https://www.youtube.com/watch?v=mEn2SEwZKNE), [Dust in the Wind](https://www.youtube.com/watch?v=tvwsFfmKw6A), [Wish You Were Here](https://www.youtube.com/watch?v=sG_K8sGflBY), [Landslide](https://www.youtube.com/watch?v=SERxZkTyQAg). YouTube embedding depends on video-owner settings. Each lesson includes an external YouTube link.

## Development

Run `node build.cjs` after changing app.js, journal.mjs, metronome.mjs or style.css. The generated bundle and hashed asset URLs are committed for static GitHub Pages hosting. No dependencies required. Run `node serve.cjs` for local preview.

Tests: in PowerShell use `$env:TZ='America/New_York'; node --test journal.test.mjs`. Tests cover elapsed time, target notification without stopping, pause/reload, midnight and daylight-saving boundaries, weekly queues, backup validation, lesson URLs and metronome ramps.

`?preview=1` uses separate test journal data. Theme preference is shared with the main journal.
