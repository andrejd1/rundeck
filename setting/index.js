// Settings page rendered inside the Zepp phone app. Everything lands in
// settingsStorage; the side service turns it into the watch config
// (shared/config.js) and pushes changes to the watch.
//
// Built only from components whose displayed value we control: choices are
// rows of chip buttons (the selected one highlighted) instead of Select, and
// every text field shows its saved value in plain text above the input, so a
// saved setting is always visible. Each line is its own block View: bare Text
// components render inline and ran into each other.
//
// The screen layout is one JSON value ("layout_json") shared with the watch's
// own layout editor: every change stamps updated_at, and the newer copy wins.
// "ui_open_slot" only remembers which field picker is expanded (re-render
// happens on settingsStorage changes).

import { readLayout, targetKeys } from "../shared/config.js"
import {
  BAR_NAMES,
  BAR_OPTIONS,
  defaultLayout,
  FIELD_IDS,
  FIELD_NAMES,
  LABEL_STYLE_NAMES,
  LABEL_STYLES,
  ROWS,
  rowSlots,
} from "../shared/fields.js"
import { BUY_URL, PRIVACY_URL } from "../shared/license.js"

const C = {
  page: "#f2f3f5",
  card: "#ffffff",
  text: "#1f2328",
  muted: "#6b7280",
  line: "#e5e7eb",
  accent: "#ef4444",
  chip: "#eef0f3",
  chipOn: "#1f2328",
  good: "#15803d",
}

// Spot name within its row. The big-number rows (2, 3) call their middle
// spot "Center" (it is the big value); thin rows call it "Middle".
function slotPosition(slotId, cols) {
  if (slotId === "header") return "Value"
  const end = slotId.slice(-1)
  if (end === "l") return "Left"
  if (end === "r") return "Right"
  const bigRow = slotId === "r2c" || slotId === "r3c"
  return cols === 3 && !bigRow ? "Middle" : "Center"
}

AppSettingsPage({
  state: {},

  build(props) {
    const store = props.settingsStorage
    const get = (k, d = "") => {
      const v = store.getItem(k)
      return v == null || v === "" ? d : String(v)
    }
    const put = (k, v) => store.setItem(k, v == null ? "" : String(v))
    const layout = readLayout((k) => store.getItem(k))
    const saveLayout = (next) =>
      put("layout_json", JSON.stringify({ ...next, updated_at: Date.now() }))
    const openSlot = get("ui_open_slot", "")

    // ------------------------------------------------------------- pieces

    const block = (children, style = {}) => View({ style }, children)
    const para = (text, style = {}) =>
      block(
        [Text({ style: { fontSize: "14px", color: C.text, ...style } }, text)],
        {
          margin: "0 0 6px 0",
        },
      )
    const hint = (text) =>
      block(
        [
          Text(
            { style: { fontSize: "12px", color: C.muted, lineHeight: "17px" } },
            text,
          ),
        ],
        { margin: "2px 0 10px 0" },
      )
    const label = (text, value) =>
      block(
        [
          Text(
            { bold: true, style: { fontSize: "14px", color: C.text } },
            text,
          ),
          value
            ? Text(
                { style: { fontSize: "14px", color: C.muted } },
                `  ${value}`,
              )
            : null,
        ],
        { margin: "10px 0 6px 0" },
      )
    const card = (title, children) =>
      block(
        [
          block(
            [
              Text(
                { bold: true, style: { fontSize: "17px", color: C.text } },
                title,
              ),
            ],
            { margin: "0 0 8px 0" },
          ),
          ...children,
        ],
        {
          background: C.card,
          borderRadius: "14px",
          padding: "14px 14px 8px 14px",
          margin: "0 0 12px 0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        },
      )
    const chip = (text, on, onClick) =>
      Button({
        label: text,
        style: {
          fontSize: "13px",
          borderRadius: "16px",
          padding: "0 12px",
          height: "32px",
          lineHeight: "32px",
          margin: "0 6px 6px 0",
          background: on ? C.chipOn : C.chip,
          color: on ? "#ffffff" : C.text,
          border: "none",
          display: "inline-block",
        },
        onClick,
      })
    const chips = (options, current, onPick) =>
      block(
        options.map((o) =>
          chip(o.name, o.value === current, () => onPick(o.value)),
        ),
        { display: "flex", flexWrap: "wrap", margin: "0 0 4px 0" },
      )
    // enum stored under one key
    const choice = (title, key, options, def, help) => [
      label(title),
      chips(options, get(key, def), (v) => put(key, v)),
      help ? hint(help) : null,
    ]
    // free text: saved value shown above the input, input pre-filled too
    const input = (title, key, placeholder, shown, help) => [
      label(
        title,
        get(key) ? `Saved: ${shown ? shown(get(key)) : get(key)}` : "Not set",
      ),
      TextInput({
        label: "",
        placeholder,
        value: get(key),
        settingsKey: key,
        onChange: (v) => put(key, String(v).trim()),
        subStyle: {
          border: `1px solid ${C.line}`,
          borderRadius: "8px",
          padding: "8px 10px",
          fontSize: "14px",
          color: C.text,
          background: "#fafafa",
        },
      }),
      help ? hint(help) : block([], { height: "6px" }),
    ]

    // From / To for the target of one metric, each shown with its saved value
    const RANGE = {
      pace: { unit: () => perUnit, from: "4:40", to: "4:50", tol: "±5 s" },
      power: { unit: () => "W", from: "250", to: "270", tol: "±3%" },
      hr: { unit: () => "bpm", from: "150", to: "160", tol: "±5 bpm" },
    }
    const rangeInputs = (metric) => {
      const r = RANGE[metric] || RANGE.pace
      const [lowKey, highKey] = targetKeys(metric)
      const unit = r.unit()
      const withUnit = (v) => `${v} ${unit}`
      return [
        ...input(`From (${unit})`, lowKey, r.from, withUnit),
        ...input(
          `To (${unit})`,
          highKey,
          r.to,
          withUnit,
          `The live value turns green inside the range, blue below, red above. Fill in one field only for a single value (${r.tol}). Leave both empty for no target.`,
        ),
      ]
    }

    // ------------------------------------------------------------- values

    const perUnit =
      get("pace_unit", "min_per_km") === "min_per_mile" ? "/mi" : "/km"
    const targetMetric = get("target_metric", "pace")
    const hrMethod = get("hr_zone_method", "device")
    const licensed = get("license_status_text").indexOf("Unlocked") === 0
    const masked = (k) =>
      k.length > 8 ? `${k.slice(0, 4)}...${k.slice(-4)}` : k

    // ------------------------------------------------------------- layout

    const slotRow = (slotId, cols) => {
      const open = openSlot === slotId
      const field = layout.slots[slotId]
      const rows = [
        Button({
          label: `${slotPosition(slotId, cols)}:  ${FIELD_NAMES[field]}   ${open ? "▴" : "▾"}`,
          style: {
            fontSize: "14px",
            textAlign: "left",
            width: "100%",
            height: "38px",
            lineHeight: "38px",
            padding: "0 12px",
            margin: "0 0 6px 0",
            borderRadius: "10px",
            background: open ? C.chipOn : C.chip,
            color: open ? "#ffffff" : C.text,
            border: "none",
          },
          onClick: () => put("ui_open_slot", open ? "" : slotId),
        }),
      ]
      if (open)
        rows.push(
          chips(
            FIELD_IDS.map((id) => ({ name: FIELD_NAMES[id], value: id })),
            field,
            (id) => {
              saveLayout({
                ...layout,
                slots: { ...layout.slots, [slotId]: id },
              })
              put("ui_open_slot", "")
            },
          ),
        )
      return block(rows)
    }

    const layoutCard = card("Screen layout", [
      hint(
        "Top to bottom, as on the watch. Tap a spot to pick its field. You can also edit the layout on the watch: open RunDeck from the app list.",
      ),
      ...ROWS.map((row) => {
        const cols = layout.cols[row.id]
        return block([
          label(row.name),
          chips(
            row.cols.map((n) => ({
              name: `${n} column${n > 1 ? "s" : ""}`,
              value: n,
            })),
            cols,
            (n) =>
              saveLayout({ ...layout, cols: { ...layout.cols, [row.id]: n } }),
          ),
          ...rowSlots(row.id, cols).map((id) => slotRow(id, cols)),
        ])
      }),
      label("Field names on the watch"),
      chips(
        LABEL_STYLES.map((id) => ({ name: LABEL_STYLE_NAMES[id], value: id })),
        layout.labels,
        (v) => saveLayout({ ...layout, labels: v }),
      ),
      hint("Short text and icons leave more room for the numbers."),
      label("Units after values"),
      chips(
        [
          { name: "Show", value: "show" },
          { name: "Hide", value: "hide" },
        ],
        layout.units,
        (v) => saveLayout({ ...layout, units: v }),
      ),
      hint(
        "Small km, W, bpm, m after the numbers. The big center numbers stay unit-free.",
      ),
      label("Zone bar (middle)"),
      chips(
        BAR_OPTIONS.map((id) => ({ name: BAR_NAMES[id], value: id })),
        layout.bar,
        (v) => saveLayout({ ...layout, bar: v }),
      ),
      hint(
        "Auto follows your target: power zones (from FTP) for a power target, pace zones (from LT pace) for a pace target, heart rate zones otherwise. The target range is marked under the bar.",
      ),
      Button({
        label: "Reset layout to default",
        style: {
          fontSize: "13px",
          borderRadius: "16px",
          height: "34px",
          lineHeight: "34px",
          margin: "4px 0 8px 0",
          background: "#fdecec",
          color: C.accent,
          border: "none",
        },
        onClick: () => saveLayout(defaultLayout()),
      }),
    ])

    // ------------------------------------------------------------- page

    return View({ style: { padding: "12px", background: C.page } }, [
      card("RunDeck", [
        para(get("license_status_text", "Trial: 5 free runs"), {
          color: licensed ? C.good : C.text,
          fontWeight: "bold",
        }),
        ...input(
          "License key",
          "license_key",
          "Paste your key",
          masked,
          "From your purchase e-mail. Clear it to move RunDeck to another watch.",
        ),
        licensed
          ? null
          : block(
              [Link({ source: BUY_URL }, "Unlock RunDeck - EUR 6, one-time")],
              { margin: "4px 0 10px 0" },
            ),
      ]),

      layoutCard,

      card("Units and laps", [
        ...choice(
          "Pace unit",
          "pace_unit",
          [
            { name: "min/km", value: "min_per_km" },
            { name: "min/mi", value: "min_per_mile" },
          ],
          "min_per_km",
        ),
        ...choice(
          "Auto lap",
          "auto_lap",
          [
            { name: `Every 1 ${perUnit === "/mi" ? "mi" : "km"}`, value: "1" },
            { name: "Off (lap key only)", value: "0" },
          ],
          "1",
          "Match the watch's own auto-lap (or turn it off) so RunDeck laps line up with the native ones.",
        ),
      ]),

      card("Target", [
        ...choice(
          "Target for",
          "target_metric",
          [
            { name: "Pace", value: "pace" },
            { name: "Power", value: "power" },
            { name: "Heart rate", value: "hr" },
          ],
          "pace",
        ),
        ...rangeInputs(targetMetric),
      ]),

      card("Heart rate zones", [
        ...choice(
          "Zones from",
          "hr_zone_method",
          [
            { name: "Watch settings", value: "device" },
            { name: "Max HR", value: "max" },
            { name: "Threshold HR", value: "lthr" },
            { name: "Custom", value: "custom" },
          ],
          "device",
        ),
        ...(hrMethod === "device"
          ? [
              hint(
                "Uses the heart rate zones set on your watch (Zepp OS 4.2+). Older watches estimate them from your age in the Zepp profile.",
              ),
            ]
          : hrMethod === "lthr"
            ? input(
                "Threshold HR (bpm)",
                "lthr",
                "170",
                (v) => `${v} bpm`,
                "Friel zones from your lactate threshold heart rate.",
              )
            : hrMethod === "custom"
              ? input(
                  "Zone start values (bpm)",
                  "hr_zones_custom",
                  "120,140,155,168,180",
                  null,
                  "Z1 to Z5 lower bounds, optionally followed by your max HR.",
                )
              : input(
                  "Max HR (bpm)",
                  "max_hr",
                  "190",
                  (v) => `${v} bpm`,
                  "Zones at 50/60/70/80/90% of max HR.",
                )),
      ]),

      card("Pace and power zones", [
        ...input(
          `Lactate threshold (LT) pace (${perUnit})`,
          "threshold_pace",
          "4:30",
          (v) => `${v} ${perUnit}`,
          "Pace zones for the zone bar are built from this.",
        ),
        ...input(
          "FTP / critical power (W)",
          "ftp",
          "280",
          (v) => `${v} W`,
          "Power zones for the zone bar are built from this.",
        ),
      ]),
      block([Link({ source: PRIVACY_URL }, "Privacy statement")], {
        margin: "4px 0 0 4px",
      }),
      block([], { height: "24px" }),
    ])
  },
})
