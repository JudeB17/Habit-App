# Isle

Habit tracker where finishing habits earns materials that build a cut-paper island. Phase 1 of the Habit App Spec: solo core, running entirely on the phone.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173, plus a LAN URL you can open on your iPhone
npm run build      # production build into dist/
```

## Deploy to GitHub Pages (free)

1. Create a repo and push this folder.
2. Repo Settings > Pages > Source: GitHub Actions.
3. Add `.github/workflows/deploy.yml`:

```yaml
name: deploy
on: { push: { branches: [main] } }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci && npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

4. Open the Pages URL in Safari on the iPhone, Share > Add to Home Screen.

`base: './'` in `vite.config.js` means it works from any sub-path, no config change needed.

## What's in phase 1

| Area | Status |
| --- | --- |
| Habits: check, count, duration, limit | Done. Schedules: daily, chosen weekdays, N per week |
| Today screen, one-tap logging | Done. Check-off squashes the card, plays a sound, flies resource tokens into the island |
| Streaks | Per habit (days, or weeks for weekly quotas) and overall |
| Rewards | 10 base x trust (verified 1.5, honour 1.0) x streak bonus (+2%/day, cap +50%) |
| Study timer | Full screen, survives closing the app, sessions of 10+ min are verified |
| Screen time | Honour bucket tap, passes if the bucket's ceiling is within the limit |
| Island | 8 illustrated buildings bought with resources, weeds after 2 idle days |
| Feed | Preview of your own daily card with privacy settings applied |
| Plan | Next 7 days of scheduled habits |
| Backup | Export and import JSON from Me |

## Not built yet

- Friends, real feed, reactions, nudges, Web Push (phase 2). `supabase/schema.sql` is ready and tested against Postgres 16.
- Photo proof (1.2x trust). The multiplier exists; no upload UI.
- 9 pm screen time prompt. Needs Web Push, so phase 2.
- Building placement on a grid. Buildings have fixed spots for now.
- Shared centre, weekly event, goals and pace lines (phases 3 to 5).

## Layout

```
src/
  lib/store.js       local-first state, mirrors the Supabase tables
  lib/game.js        rules: categories, yields, buckets, buildings
  lib/dates.js       local day keys (never UTC)
  lib/sound.js       synthesised sounds, no audio files
  components/        Island (SVG pieces), HabitCard, sheets, timer, fx overlay
  screens/           Today, Island, Feed, Plan, Me
supabase/schema.sql  tables, RLS, server-side scoring trigger, build() function
```

## Known limits

- Data lives in localStorage on one device. Clearing Safari website data wipes it; export a backup.
- iOS suspends background JS, so the timer has no lock screen countdown and the end chime only plays with the app open. The elapsed time is still correct when you come back.
- Resources update the moment you log. If you undo a habit after spending, a resource can go negative.
