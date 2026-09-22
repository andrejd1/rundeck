# RunDeck — one-screen running dashboard for Amazfit (Zepp OS)

A **Zepp OS Workout Extension** that pins a dense, glanceable data screen inside the native
Amazfit running workout: HR with a live zone-colored history graph, lap vs average HR and
pace around a big center pace (or power), a five-zone bar, elapsed time, cadence, lap
distance, grade, distance and total ascent — all on one page.

The native workout keeps GPS, recording, laps and the activity file; RunDeck only reads
native data and renders it.

![RunDeck screens](docs/ui-preview.png)

## The screen

```
        [HR graph, last 6 min]  106 Z1
      Lap HR 105   │   117 Avg HR
 Lap Pace        5'38         Avg Pace       <- center: pace or power, colored vs target
   4'52                         4'42
 ▬▬▬▬▬▬▬▮▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬           <- zone bar: HR, pace or power zones
 Lap Time        33:34        Cadence
   00:43                         178
      Lap Dist 0.14  │  -3% Grade           <- also where lap / trial notices flash
        Distance 7.14   Ascent 115
```

| Field | Source |
|---|---|
| HR | HeartRate sensor (`data:user.hd.heart_rate`) |
| Pace, distance, elapsed, cadence, avg pace, total ascent, altitude | native `getSportData` (`pace`, `distance`, `duration`, `cadence`, `avg_pace`, `total_up_altitude`, `altitude`) |
| Power | `getSportData("power")` — **not in the documented types**, probed only when power is shown |
| Lap HR / pace / time / distance, avg HR, HR graph, grade | computed in `shared/stats.js` from the native samples, driven by the native elapsed clock (a paused workout accumulates nothing) |

Settings (Zepp app → RunDeck): pace unit, center metric (pace / power), zone bar metric
(HR / pace / power), auto-lap (1 km|mi or off), a target range for the center metric, HR
zones (from max HR, threshold HR, or custom bounds), threshold pace and FTP.

**Laps:** the lap key closes a RunDeck lap *and* the native lap. Native auto-laps are not
visible to extensions, so RunDeck runs its own auto-lap — set the watch's auto-lap to the
same distance (or off) to keep both in step.

## Trial and license

- **5 free runs.** A run counts once it passes 5 minutes of native time, once per activity;
  reopening the screen in the same activity is recognized and never costs a run
  (`shared/trial.js`). The run that uses up the trial finishes on the full screen.
- After that the screen drops to **basic mode** (HR, pace, time, distance + "Unlock in Zepp
  app"). It never locks mid-run, and a license that arrives mid-run unlocks immediately.
- The count lives on the watch and is mirrored to the phone (max wins). It is not
  tamper-proof: the watch code is plain JavaScript, so the goal is "paying is easier than
  cracking", not DRM.
- **Unlock:** €6 one-time through [Polar.sh](https://polar.sh) (merchant of record). The
  buyer gets a license key by e-mail, pastes it into the RunDeck settings; the phone side
  service activates it against Polar's public license endpoint (no RunDeck server) and pushes
  the unlock to the watch. Granted keys are re-validated weekly when online; offline the
  unlock simply stays. Clearing the key deactivates it so it can move to another watch.

### Why Polar.sh (researched 2026-09)

| | Polar.sh | Lemon Squeezy | Gumroad | Paddle |
|---|---|---|---|---|
| Merchant of record (EU VAT handled) | yes | yes | yes | yes |
| License keys with a **public** activate/validate API (callable from the phone, no server) | yes | yes | verify only | no — needs your own key server |
| Fee on a €6 sale | 5% + $0.50 (new orgs, since May 2026) | 5% + 50¢ | 10% + $0.50 + card processing | 5% + 50¢ |
| Platform risk | active, open source | being migrated into Stripe Managed Payments | stable | stable |

Lemon Squeezy was the other real candidate, but it is being folded into Stripe Managed
Payments, which does not carry over all of Lemon Squeezy's features — the wrong time to
start on it. Gumroad takes roughly twice the cut on a €6 sale.

Rough net per sale: €6 − ~€0.75 Polar fee (more on international cards) − VAT if the price is
VAT-inclusive (e.g. 21% CZ) ≈ **€4–5**, before payout fees ($2/month in payout months +
0.25%). Check Polar's price/tax settings before publishing.

### Polar setup (one-time, needed before release)

1. Create an organization on polar.sh (test first on `sandbox.polar.sh`).
2. Create a product **RunDeck**, one-time price **€6**, with a **License Keys** benefit:
   activation limit 3 (one person, a couple of watches), no expiry.
3. Copy the organization id and the product's checkout link into `shared/license.js`
   (`POLAR_ORG_ID`, `BUY_URL`). For sandbox testing pass `api: POLAR_SANDBOX_API`.

## Project layout

| Path | What |
|---|---|
| `data-widget/common/index.js` | the screen: tick loop, rendering, lap key, trial/license gating |
| `data-widget/common/index.r.layout.js` | 480px round layout (px()-scaled) |
| `data-widget/common/metrics.js` | native data reader with battery-aware polling |
| `app.js` | receives phone pushes (config/license) for the whole mini program |
| `app-side/index.js` | phone side service: config build, Polar activation, trial mirror |
| `setting/index.js` | Zepp app settings page |
| `shared/` | platform-free logic (stats, zones, target, trial, license, config, format) |
| `sim/`, `tests/` | headless Zepp OS stubs, preview renderer, Node tests |

## Develop

```
npm install
npm test              # 53 tests: logic + the real widget/side service against stubs
npm run preview       # renders sim/out/preview.html
npm run screenshots   # regenerates docs/ui-preview.png and docs/screenshots/
```

Device: install the Zeus CLI (`npm i -g @zeppos/zeus-cli`), register the app in the Zepp
developer console and put its id in `app.json` (`appId` is `0` until then), then
`zeus preview` and scan the QR code in the Zepp app (developer mode). Requires Zepp OS 3.6+
(workout-extension watches: T-Rex 3, Balance 2, Active 2, Cheetah family, ...).

## Needs on-device verification

- Real font widths: the preview renders with DejaVu Sans Bold, which is wider than the
  watch font, so the device should have *more* room than the screenshots — but check the
  two-column rows and a 1 h+ elapsed time.
- `getSportData` shapes for `avg_pace`, `altitude`, `total_up_altitude` and whether the
  undocumented `power` channel answers with a Stryd paired.
- Battery: 5 IPC reads/s plus the widget updates, versus Intervals Guide's budget.
- The settings page `Link` and the side-service `fetch` POST with a JSON body against Polar.
- Whether the zone bar marker reads well in sunlight at 8 px.
