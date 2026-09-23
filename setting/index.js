// Settings page rendered inside the Zepp phone app. Everything lands in
// settingsStorage; the side service turns it into the watch config
// (shared/config.js) and pushes changes to the watch.
//
// The screen layout is one JSON value ("layout_json") shared with the watch's
// own layout editor: every change stamps updated_at, and the newer copy wins.

import { readLayout } from "../shared/config.js"
import {
  BAR_NAMES,
  BAR_OPTIONS,
  defaultLayout,
  FIELD_IDS,
  FIELD_NAMES,
  SLOTS,
} from "../shared/fields.js"
import { BUY_URL } from "../shared/license.js"

const FIELD_OPTIONS = FIELD_IDS.map((id) => ({
  name: FIELD_NAMES[id],
  value: id,
}))
const BAR_SELECT = BAR_OPTIONS.map((id) => ({ name: BAR_NAMES[id], value: id }))

AppSettingsPage({
  build(props) {
    const store = props.settingsStorage
    const get = (k, d = "") => {
      const v = store.getItem(k)
      return v == null || v === "" ? d : v
    }
    const set = (k) => (val) => store.setItem(k, String(val).trim())

    const layout = readLayout((k) => store.getItem(k))
    const saveLayout = (next) =>
      store.setItem(
        "layout_json",
        JSON.stringify({ ...next, updated_at: Date.now() }),
      )

    const gap = (px) => View({ style: { height: `${px}px` } })
    const hint = (text) =>
      Text({ style: { fontSize: "12px", color: "#888" } }, text)
    const heading = (text) =>
      Text(
        { bold: true, style: { fontSize: "18px", margin: "16px 0 8px 0" } },
        text,
      )
    const field = (label, key, placeholder, help) =>
      View({ style: { margin: "0 0 14px 0" } }, [
        Text({ bold: true, style: { fontSize: "14px" } }, label),
        TextInput({
          label: "",
          placeholder,
          value: get(key),
          onChange: set(key),
          subStyle: {
            border: "1px solid #ccc",
            borderRadius: "6px",
            padding: "8px",
            marginTop: "4px",
          },
        }),
        help ? hint(help) : null,
      ])
    const select = (label, value, options, onChange) =>
      View({ style: { margin: "0 0 10px 0" } }, [
        Select({ label, options, value, onChange }),
      ])
    const setting = (label, key, options, def) =>
      select(label, get(key, def), options, set(key))

    const targetMetric = get("target_metric", "pace")
    const hrMethod = get("hr_zone_method", "device")
    const perUnit =
      get("pace_unit", "min_per_km") === "min_per_mile" ? "/mi" : "/km"

    return View({ style: { padding: "12px" } }, [
      hint("Add RunDeck as a data page of your Run workout on the watch."),

      heading("RunDeck license"),
      Text(
        { style: { fontSize: "14px", margin: "0 0 8px 0" } },
        get("license_status_text", "Trial: 5 free runs"),
      ),
      field(
        "License key",
        "license_key",
        "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
        "Paste the key from your purchase e-mail. Clear it to move RunDeck to another watch.",
      ),
      Link({ source: BUY_URL }, "Unlock RunDeck - EUR 6, one-time"),

      heading("Screen layout"),
      hint(
        "Pick a field for every spot on the screen, top to bottom. You can also change this on the watch: open RunDeck from the app list.",
      ),
      gap(8),
      ...SLOTS.map((slot) =>
        select(slot.name, layout.slots[slot.id], FIELD_OPTIONS, (val) =>
          saveLayout({
            ...layout,
            slots: { ...layout.slots, [slot.id]: String(val) },
          }),
        ),
      ),
      select("Zone bar (middle)", layout.bar, BAR_SELECT, (val) =>
        saveLayout({ ...layout, bar: String(val) }),
      ),
      hint(
        "Auto follows your target: power zones (from FTP) for a power target, pace zones (from LT pace) for a pace target, heart rate zones otherwise. The target range is marked under the bar. Zepp doesn't share planned workouts with extensions, so the bar can't follow workout steps.",
      ),
      Button({
        label: "Reset layout to default",
        onClick: () => saveLayout(defaultLayout()),
      }),

      heading("Units and laps"),
      setting(
        "Pace unit",
        "pace_unit",
        [
          { name: "min/km", value: "min_per_km" },
          { name: "min/mi", value: "min_per_mile" },
        ],
        "min_per_km",
      ),
      setting(
        "Auto lap",
        "auto_lap",
        [
          { name: `Every 1 ${perUnit === "/mi" ? "mi" : "km"}`, value: "1" },
          { name: "Off (lap key only)", value: "0" },
        ],
        "1",
      ),
      hint(
        "Turn the watch's own auto-lap off (or match it) so RunDeck laps line up with the native ones.",
      ),

      heading("Target"),
      setting(
        "Target for",
        "target_metric",
        [
          { name: "Pace", value: "pace" },
          { name: "Power", value: "power" },
        ],
        "pace",
      ),
      field(
        targetMetric === "power"
          ? "Power target (W)"
          : `Pace target (${perUnit})`,
        "target_range",
        targetMetric === "power" ? "250-270" : "4:40-4:50",
        "Wherever the live pace (or power) is on screen it turns green inside the range, blue below, red above. Leave empty for no target.",
      ),

      heading("Heart rate zones"),
      setting(
        "Zones from",
        "hr_zone_method",
        [
          { name: "Watch settings (recommended)", value: "device" },
          { name: "Max HR (50/60/70/80/90%)", value: "max" },
          { name: "Threshold HR (Friel)", value: "lthr" },
          { name: "Custom", value: "custom" },
        ],
        "device",
      ),
      hrMethod === "device"
        ? hint(
            "Uses the heart rate zones set on your watch (Zepp OS 4.2+). Older watches estimate them from your age in the Zepp profile.",
          )
        : hrMethod === "lthr"
          ? field("Threshold HR (bpm)", "lthr", "170")
          : hrMethod === "custom"
            ? field(
                "Zone start values (bpm)",
                "hr_zones_custom",
                "120,140,155,168,180",
                "Z1 to Z5 lower bounds, optionally followed by your max HR.",
              )
            : field("Max HR (bpm)", "max_hr", "190"),

      heading("Pace and power zones"),
      field(
        `Lactate threshold (LT) pace (${perUnit})`,
        "threshold_pace",
        "4:30",
        "Pace zones for the zone bar are built from this.",
      ),
      field(
        "FTP / critical power (W)",
        "ftp",
        "280",
        "Power zones for the zone bar are built from this.",
      ),
      gap(24),
    ])
  },
})
