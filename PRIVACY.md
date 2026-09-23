# RunDeck Privacy Statement

Effective 23 September 2026

RunDeck is a data screen for Amazfit running workouts, made by Thien Long Ngo (andrejd1),
who is responsible for the processing described here. This statement explains what data
RunDeck uses, where it stays and what, if anything, leaves your devices.

**In short:** your workout data never leaves your watch. RunDeck has no accounts, no
analytics, no ads and no tracking. The only thing it sends over the internet is your
license key, to Polar, when you unlock it.

## What RunDeck uses on your watch

To draw its screen during a run, RunDeck reads from your watch:

- **Workout data** from the running workout: heart rate, pace, speed, distance, time,
  cadence, altitude, ascent, calories and, if a power meter is paired, power. Values such
  as descent, stride or training effect are drawn by the watch itself; RunDeck never
  receives them.
- **Your heart-rate zones** from the watch settings, to color zones and the zone bar.
- **Your age** from your Zepp profile, only on watches too old to report heart-rate zones,
  to estimate them (220 minus age).

This data is used only while the screen is open. It is not stored and never leaves the
watch. RunDeck works out lap times, averages, the heart-rate graph and grade from it, and
discards them when the run ends.

RunDeck keeps these settings in the watch's app storage:

- your screen layout and display settings;
- the trial counter: how many runs have been counted, plus the time and duration of the
  last one, so reopening the screen in the same run doesn't count twice;
- whether RunDeck is unlocked.

They are deleted when you uninstall RunDeck.

## What RunDeck stores on your phone

The RunDeck settings in the Zepp App keep, on your phone:

- your settings (layout, units, targets, zones, thresholds);
- your license key and its activation status;
- the trial counter, mirrored from the watch;
- your watch's device identifier, used to label the license activation (see below).

The Zepp App stores these as part of its app settings, so Zepp's own privacy policy also
applies to them. They are deleted when you uninstall RunDeck.

## What is sent over the internet

Only license checks, and only after you enter a key. The Zepp App on your phone sends to
Polar (polar.sh), RunDeck's reseller:

- **Activation** (when you enter a key): the key, RunDeck's seller id at Polar, and a label
  made of `watch-` plus the first 16 characters of your watch's device identifier, so you
  can tell your activations apart.
- **Validation** (at most once a week while unlocked): the key and its activation id.
- **Deactivation** (when you clear the key): the key and its activation id.

Like any web request, these also reveal your phone's IP address to Polar. Nothing else is
sent — no workout data, no location, no settings. If you never enter a key, RunDeck sends
nothing at all.

## Buying RunDeck

Polar (polar.sh) sells RunDeck as merchant of record: it processes the payment, handles
VAT and emails you the license key. Polar collects what it needs for that (such as your
e-mail address, name, country and payment details) under
[Polar's privacy policy](https://polar.sh/legal/privacy-policy). Card details are never shared
with the developer. The developer receives the order details Polar shares with sellers
(such as e-mail address, country and the key), and uses them only to deliver and support
your license and to keep the records tax law requires.

## This website

The RunDeck website is hosted on GitHub Pages and loads its fonts from Google Fonts. Both
receive your IP address when you open the page, under their own privacy policies. The site
sets no cookies and uses no analytics.

## Your rights

Under the GDPR you can ask what data about you the developer holds, and ask for it to be
corrected or deleted. Because RunDeck keeps your data on your own devices, you control
most of it directly:

- Uninstall RunDeck to delete everything it stores on your watch and phone.
- Clear the license key in the settings to deactivate it at Polar.
- For purchase records, contact the developer or Polar.

You can also complain to your data protection authority.

## Children

RunDeck is not directed at children and does not knowingly collect data about them.

## Changes

If this statement changes, the new version is published here with a new effective date.
Changes that send more data anywhere will be listed in the app's changelog.

## Contact

Thien Long Ngo (andrejd1) — [github.com/andrejd1](https://github.com/andrejd1)
