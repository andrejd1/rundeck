// Settings page rendered inside the Zepp phone app. Everything lands in
// settingsStorage; the side service turns it into the watch config
// (shared/config.js) and pushes changes to the watch.

import { BUY_URL } from "../shared/license.js"

AppSettingsPage({
  build(props) {
    const store = props.settingsStorage
    const get = (k, d = "") => {
      const v = store.getItem(k)
      return v == null || v === "" ? d : v
    }
    const set = (k) => (val) => store.setItem(k, String(val).trim())

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
    const select = (label, key, options, def) =>
      View({ style: { margin: "0 0 14px 0" } }, [
        Select({
          label,
          options,
          value: get(key, def),
          onChange: set(key),
        }),
      ])

    const primary = get("primary_metric", "pace")
    const hrMethod = get("hr_zone_method", "max")
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

      heading("Screen"),
      select(
        "Pace unit",
        "pace_unit",
        [
          { name: "min/km", value: "min_per_km" },
          { name: "min/mi", value: "min_per_mile" },
        ],
        "min_per_km",
      ),
      select(
        "Big center metric",
        "primary_metric",
        [
          { name: "Pace", value: "pace" },
          { name: "Power (needs a power meter)", value: "power" },
        ],
        "pace",
      ),
      select(
        "Zone bar",
        "bar_metric",
        [
          { name: "Heart rate zones", value: "hr" },
          { name: "Pace zones (needs threshold pace)", value: "pace" },
          { name: "Power zones (needs FTP)", value: "power" },
        ],
        "hr",
      ),
      select(
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
      field(
        primary === "power" ? "Power target (W)" : `Pace target (${perUnit})`,
        "target_range",
        primary === "power" ? "250-270" : "4:40-4:50",
        "The big center number turns green inside the range, blue below, red above. Leave empty for no target.",
      ),

      heading("Heart rate zones"),
      select(
        "Zones from",
        "hr_zone_method",
        [
          { name: "Max HR (50/60/70/80/90%)", value: "max" },
          { name: "Threshold HR (Friel)", value: "lthr" },
          { name: "Custom", value: "custom" },
        ],
        "max",
      ),
      hrMethod === "lthr"
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
        `Threshold pace (${perUnit})`,
        "threshold_pace",
        "4:30",
        "Needed for the pace zone bar.",
      ),
      field(
        "FTP / critical power (W)",
        "ftp",
        "280",
        "Needed for the power zone bar.",
      ),
      gap(24),
    ])
  },
})
