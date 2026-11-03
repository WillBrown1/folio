# repertoire

A personal guitar practice journal, hosted at https://willbrown1.github.io/stillblade/ using the existing repository.

- Add and edit songs, artists, song BPM, default practice minutes, YouTube lesson links, and notes.
- Tap the circle next to a song to start its timer. Elapsed time is saved as you play, with a filling progress ring and a completion chime.
- Open a song for a month-by-month calendar, practice totals, an embedded lesson, and an optional metronome.
- Assign songs and minutes to each weekday, enable Run schedule, and start today's automatically generated queue. All practice counts toward that day's goal; extra practice remains available.
- The metronome supports 20–300 BPM, 2/3/4/6 beats per bar, and optional tempo increases after a configurable number of bars up to a target BPM.

## Data

Songs, plans, notes, and history are stored in localStorage in the current browser/device. There is no account or server-side sync. Export/import a JSON journal to back up or transfer data. Initial songs are clearly labeled starter songs with no fabricated practice history; edit or remove them. Song tempos are editable practice references, not authoritative recording measurements.

Timers use timestamps and recover on reload, stop at the chosen duration, and split credited time at local midnight. Paused time is excluded. Keep the page open and device awake for the completion sound; mobile browsers can restrict background audio. A screen wake lock is requested while timing where supported. Metronome audio stops when the song card closes. YouTube embeds require internet access and may be restricted by the video's owner; each lesson also links directly to YouTube.

## Development

No dependencies or package installation. Run `node build.cjs` after editing `app.js`, `journal.mjs`, or `metronome.mjs`. The generated `app.bundle.js` is committed for static hosting. Run `node serve.cjs` for a preview on http://localhost:4173.

Run tests with `TZ=America/New_York node --test journal.test.mjs` (PowerShell: `$env:TZ='America/New_York'; node --test journal.test.mjs`). Tests cover timers, pause/resume, reload recovery, midnight/daylight-saving boundaries, weekly queues, backup validation, YouTube parsing, and metronome tempo ramps.

GitHub Pages serves the main branch root. The old repository name and URL are retained. No journal data or credentials are uploaded to GitHub; only app source is deployed.

## Starter lesson sources

Starter songs include freely accessible lessons from their teachers' YouTube channels. These can be replaced in Edit song:

- [Blackbird — JustinGuitar Songs](https://www.youtube.com/watch?v=mEn2SEwZKNE)
- [Dust in the Wind — Marty Music](https://www.youtube.com/watch?v=tvwsFfmKw6A)
- [Wish You Were Here — JustinGuitar Songs](https://www.youtube.com/watch?v=sG_K8sGflBY)
- [Landslide — Marty Music](https://www.youtube.com/watch?v=SERxZkTyQAg)

For UI testing, `?preview=1` uses a separate local journal so test practice never changes the normal journal.
