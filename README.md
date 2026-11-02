# Fairway

Habit tracker where habits and Pomodoro blocks earn money that keeps a cut-paper 18 hole golf course alive. Stage 2 of the Habit App Spec: the solo core plus friends, a feed, and visiting friends' courses.

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

## Friends setup (one time, free)

1. Make a project at supabase.com (free tier). Region: Sydney.
2. SQL Editor > New query > paste all of `supabase/schema.sql` > Run.
3. Authentication > Sign In / Providers > Email: turn **Confirm email** off. Sign in is email and password; with confirmation on, the free email sender's hourly limit gets hit as soon as a few friends sign up, and confirmation links open in Safari instead of the home screen app.
4. Project Settings > API: copy the **Project URL** and the **anon public** key.
5. GitHub repo > Settings > Secrets and variables > Actions > Variables tab: add `SUPABASE_URL` and `SUPABASE_ANON_KEY` with those values. Re-run the deploy workflow.
6. For local dev, put the same two values in `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

The anon key is meant to be public. Row level security in the schema is what stops anyone reading your data: you only see people who share a group with you, and nobody can join a group without its code.

Free tier note: Supabase pauses a project after 7 days with no traffic. Daily use keeps it awake; if it pauses, hit Restore in the dashboard.

## What's in 0.3: friends

| Area | Status |
| --- | --- |
| Accounts | Email and password. Optional: the app still works fully offline and signed out |
| Groups | Create a group, share the 8 character code, friends join with it. You can be in several groups; friends are everyone who shares one with you |
| What friends see | A card per person: today's habits (visibility rules apply: private habits are left out, summary habits show as "private"), focus time, blocks, streak, last 7 days, and the whole course |
| Friend's course | Tap a friend: their map, rating, condition, damage, clubhouse, barn, collection. Tap a hole to see it close up. Decay keeps running while they're away, so a friend who stops opening the app browns on your screen too |
| Feed | One card per person per day that updates as habits are ticked off, plus moments: finished or failed Pomodoro stacks, goals (names can be hidden in Me), new items, streak milestones, clubhouse and barn builds |
| Reactions and comments | 5 reactions per post, comments with delete for your own and on your own posts |
| Sync | Local-first. Changes publish 4 s after they happen, when the app is hidden, and when it comes back online. Feed refreshes on open and every 90 s while visible |
| Backup | Full state saved privately every 10 min while signed in. Sign in on a new phone and it offers to restore. A fresh install never overwrites the cloud backup and publishes nothing until it's restored |

## What's in 0.2: solo core

| Area | Status |
| --- | --- |
| Habits: check, count, duration, limit | Schedules: daily, chosen weekdays, N per week |
| Money | Habits pay $10 x trust x streak bonus. Pomodoro blocks pay $0.40 a focus minute, +20% for finishing a full stack |
| Pomodoro | Presets 25/5 and 50/10 or custom focus, break, long break, long-break interval and block count. Add blocks mid-run |
| Leave rule | Off screen for more than 10 s during focus fails that block only; the run stops, earlier blocks still pay. Breaks are free time. Failed blocks damage the hole being played |
| Course | 18 holes, par 72. Each hole has condition plus tee, fairway, bunkers and green upgrades (3 levels each). Clubhouse has 5 levels |
| Decay | Every hole loses 6% a day down to a 30% floor. Damage can push lower |
| Upkeep | Money plus materials. Per condition point restored: $1 per 4, fuel and water 1 per 40, fertiliser and sand 1 per 80. Costs round up once per job, so maintain all is cheaper than hole by hole. Repairs: $25 plus divot 2 seed + 1 sand, water 2 fuel, brown patch 2 seed + 2 water |
| Barn | Stores fuel, water, fertiliser, sand, seed. Cap 30 / 60 / 120 / 250 by level ($150, $400, $900). Overflow sells for $1 a unit |
| Chests | Crate 6 to 9 units, chest 18 to 24, big chest 40 to 50. Rolls lean towards what you're low on. Item chance 10% / 35% / 100% |
| Goals | Small (due 1+ days, crate), medium (3+ days, chest), big (7+ days, big chest). Must be set on an earlier day to pay; late goals pay one size down |
| Items | 12 collectibles placed on the course, from chests only. Streak milestones (7/21/50/100 days, 4/12/26 weeks) give a chest; 4+ block stacks have a 30% chance of a crate. Duplicates sell for money |
| Stats | Focus time by day or week, Pomodoro finished vs failed and best stack, per habit 30 day hit rate and streaks |
| Plan | Goals with deadlines, plus the next 7 days |
| Open timer | Still there for sessions without the leave rule |
| Backup | Export and import JSON from Me. Old Isle data migrates: logs and habits carry over, island spending becomes money |


## Layout

```
src/
  lib/store.js       local-first state, mirrors the Supabase tables
  lib/social.js      Supabase: auth, groups, publish, feed, reactions, backup
  lib/card.js        what friends see, built from local state
  lib/game.js        rules: money, Pomodoro, course economy, drops
  lib/holes.js       geometry for the 18 holes, shared by the map and hole view
  lib/dates.js       local day keys (never UTC)
  lib/sound.js       synthesised sounds, no audio files
  components/        Course (map, hole view, clubhouse, drops), PomodoroScreen, HabitCard, sheets, fx
  screens/           Today, Course, Feed, FriendView, Stats, Plan, Me
supabase/schema.sql  profiles, groups, cards, events, reactions, comments, backups + RLS
```

## Known limits

- Data lives in localStorage on one device. Signed in, there's a cloud backup; signed out, clearing Safari website data wipes it, so export a backup.
- One phone per account. The backup is last-write-wins for the whole state, so using two phones on the same account will overwrite one with the other.
- Everything friends see is published by the phone, so it's honour system like the rest. Someone who edits their local storage can fake a perfect course.
- No push notifications yet. Friends' activity shows when you open the app.
- iOS suspends background JS, so the timer has no lock screen countdown and the end chime only plays with the app open. The elapsed time is still correct when you come back.
- Money updates the moment you log. Undo a habit after spending and the balance can go negative.
- The leave check uses a heartbeat in localStorage. It's honest-use enforcement, not anti-cheat: anyone can edit storage.
- Screen auto-lock counts as leaving. The app asks for a wake lock, but iOS home screen apps only honour it on recent iOS versions, so set Auto-Lock to Never or 5 min while studying if blocks fail on their own.
