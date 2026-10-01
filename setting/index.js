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
// happens on settingsStorage changes); the other ui_* keys are page state
// the same way (a pending confirmation, the export view, pasted import text).
//
// Presets (shared/presets.js) and export / import (shared/backup.js) live
// here; the watch can switch presets too, but export and import are only
// on the phone.

import { exportSettings, importSettings } from "../shared/backup.js"
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
import {
  MAX_PRESETS,
  newPresetId,
  PRESET_NAME_MAX,
  PRESET_TARGET_KEYS,
  presetFromSettings,
  presetMatches,
  presetSettings,
  readActive,
  readPresets,
} from "../shared/presets.js"

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
    // a target edit is stamped, so a preset picked earlier on the watch
    // can't roll it back (shared/presets.js)
    const put = (k, v) => {
      store.setItem(k, v == null ? "" : String(v))
      if (PRESET_TARGET_KEYS.indexOf(k) >= 0)
        store.setItem("target_at", String(Date.now()))
    }
    // many keys at once (a preset, an import): only the ones that change
    const putAll = (values) => {
      for (const k of Object.keys(values))
        if (get(k) !== values[k]) store.setItem(k, values[k])
    }
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
    // `raw`: saved only through settingsKey, as typed (the license key: a
    // second trimmed write would reach the phone service as a second change)
    const input = (title, key, placeholder, shown, help, raw) => [
      label(
        title,
        get(key) ? `Saved: ${shown ? shown(get(key)) : get(key)}` : "Not set",
      ),
      TextInput({
        label: "",
        placeholder,
        value: get(key),
        settingsKey: key,
        onChange: raw ? undefined : (v) => put(key, String(v).trim()),
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
    const keyFailed =
      get("license_status_text").indexOf("Key not activated") === 0
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

    // ------------------------------------------------------------ presets

    const presets = readPresets(get)
    const active = readActive(get)
    const confirm = get("ui_confirm", "")
    const savePresets = (list) => put("presets_json", JSON.stringify(list))
    const action = (text, onClick, danger) =>
      Button({
        label: text,
        style: {
          fontSize: "13px",
          borderRadius: "16px",
          padding: "0 12px",
          height: "32px",
          lineHeight: "32px",
          margin: "0 6px 6px 0",
          background: danger ? "#fdecec" : C.chip,
          color: danger ? C.accent : C.text,
          border: "none",
          display: "inline-block",
        },
        onClick,
      })
    const actions = (buttons) =>
      block(buttons, { display: "flex", flexWrap: "wrap", margin: "0 0 4px 0" })

    const presetRow = (p) => {
      const isActive = !!active && active.id === p.id
      const same = presetMatches(get, p, layout)
      const status = isActive ? (same ? "Active" : "Active, changed since") : ""
      const replace = () =>
        savePresets(
          presets.map((q) =>
            q.id === p.id ? presetFromSettings(get, p.id, p.name, layout) : q,
          ),
        )
      let buttons
      if (confirm === `del:${p.id}`)
        buttons = [
          action(
            `Delete ${p.name}`,
            () => {
              savePresets(presets.filter((q) => q.id !== p.id))
              if (isActive) put("preset_active", "")
              put("ui_confirm", "")
            },
            true,
          ),
          action("Keep", () => put("ui_confirm", "")),
        ]
      else if (confirm === `upd:${p.id}`)
        buttons = [
          action("Overwrite with current", () => {
            replace()
            put("preset_active", JSON.stringify({ id: p.id, at: Date.now() }))
            put("ui_confirm", "")
          }),
          action("Keep", () => put("ui_confirm", "")),
        ]
      else
        buttons = [
          isActive && same
            ? null
            : action("Apply", () => {
                putAll(presetSettings(p, Date.now()))
                put("ui_confirm", "")
              }),
          same
            ? null
            : action("Save current", () => put("ui_confirm", `upd:${p.id}`)),
          action("Delete", () => put("ui_confirm", `del:${p.id}`), true),
        ]
      return block([label(p.name, status), actions(buttons)])
    }

    const presetsCard = card("Presets", [
      hint(
        "A preset keeps the screen layout and the target, so you can switch between, say, an easy run and intervals in one tap. Zones, FTP, LT pace and the pace unit stay as they are. Switch here or on the watch: open RunDeck from the app list, then Presets.",
      ),
      ...presets.map(presetRow),
      presets.length < MAX_PRESETS
        ? block([
            label("Save current layout and target as"),
            TextInput({
              label: "",
              placeholder: `Preset name, e.g. Intervals (max ${PRESET_NAME_MAX} letters)`,
              value: "",
              onChange: (v) => {
                const name = String(v == null ? "" : v).trim()
                if (!name) return
                const p = presetFromSettings(get, newPresetId(), name, layout)
                if (!p) return
                savePresets([...presets, p])
                put(
                  "preset_active",
                  JSON.stringify({ id: p.id, at: Date.now() }),
                )
              },
              subStyle: {
                border: `1px solid ${C.line}`,
                borderRadius: "8px",
                padding: "8px 10px",
                fontSize: "14px",
                color: C.text,
                background: "#fafafa",
              },
            }),
            block([], { height: "10px" }),
          ])
        : hint(`Up to ${MAX_PRESETS} presets: delete one to save another.`),
    ])

    // ----------------------------------------------------- export / import

    const exportOpen = get("ui_export_open") === "1"
    const importText = get("ui_import_text", "")
    const importStatus = get("ui_import_status", "")
    const pending = importText ? importSettings(importText) : null
    const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`
    const backupCard = card("Export and import", [
      hint(
        "Copy all your settings and presets to another phone, or keep them safe before reinstalling. The license key is not included: enter it again after a new install.",
      ),
      actions([
        action(exportOpen ? "Hide export" : "Export settings", () =>
          put("ui_export_open", exportOpen ? "" : "1"),
        ),
      ]),
      ...(exportOpen
        ? [
            TextInput({
              label: "",
              value: exportSettings(get),
              subStyle: {
                border: `1px solid ${C.line}`,
                borderRadius: "8px",
                padding: "8px 10px",
                fontSize: "12px",
                color: C.text,
                background: "#fafafa",
              },
            }),
            hint(
              "Select all of this text and copy it, for example into a note or an e-mail to yourself.",
            ),
          ]
        : []),
      label("Import"),
      TextInput({
        label: "",
        placeholder: "Paste exported settings here",
        value: importText,
        onChange: (v) => {
          put("ui_import_status", "")
          put("ui_import_text", String(v == null ? "" : v).trim())
        },
        subStyle: {
          border: `1px solid ${C.line}`,
          borderRadius: "8px",
          padding: "8px 10px",
          fontSize: "12px",
          color: C.text,
          background: "#fafafa",
        },
      }),
      pending && !pending.ok
        ? para(`Can't import: ${pending.message}.`, { color: C.accent })
        : null,
      pending && pending.ok
        ? block([
            hint(
              `Found ${plural(pending.settings, "setting")}, ${plural(pending.presets, "preset")} and a screen layout. Importing replaces your current settings and presets.`,
            ),
            actions([
              action("Import and replace", () => {
                const r = importSettings(importText)
                if (!r.ok) return
                putAll(r.values)
                put("ui_import_text", "")
                put("ui_confirm", "")
                put(
                  "ui_import_status",
                  `Imported ${plural(r.settings, "setting")} and ${plural(r.presets, "preset")}.`,
                )
              }),
              action("Cancel", () => put("ui_import_text", "")),
            ]),
          ])
        : null,
      importStatus && !importText
        ? para(importStatus, { color: C.good, fontWeight: "bold" })
        : null,
      block([], { height: "6px" }),
    ])

    // ------------------------------------------------------------- page

    return View({ style: { padding: "12px", background: C.page } }, [
      card("RunDeck", [
        para(get("license_status_text", "Trial: 5 free runs"), {
          color: licensed ? C.good : keyFailed ? C.accent : C.text,
          fontWeight: "bold",
        }),
        ...input(
          "License key",
          "license_key",
          "Paste your key",
          masked,
          "From your purchase e-mail. Clear it to move RunDeck to another watch.",
          true,
        ),
        licensed
          ? null
          : block(
              [Link({ source: BUY_URL }, "Unlock RunDeck - EUR 6, one-time")],
              { margin: "4px 0 10px 0" },
            ),
      ]),

      presetsCard,

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
      backupCard,

      block([Link({ source: PRIVACY_URL }, "Privacy statement")], {
        margin: "4px 0 0 4px",
      }),
      block([], { height: "24px" }),
    ])
  },
})
