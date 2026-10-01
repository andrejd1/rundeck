// Renders the real phone settings page with stub components (plain trees)
// and checks the page shows every saved value and writes what it should.
import assert from "node:assert/strict"
import { test } from "node:test"

const node =
  (type) =>
  (props = {}, children) => ({
    type,
    props,
    children: children == null ? [] : [].concat(children),
  })
for (const t of [
  "View",
  "Text",
  "Button",
  "TextInput",
  "Link",
  "Section",
  "Select",
  "Toggle",
])
  globalThis[t] = node(t)
let page
globalThis.AppSettingsPage = (p) => {
  page = p
}
await import("../setting/index.js")

function render(values = {}) {
  const store = new Map(Object.entries(values))
  const settingsStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  }
  const tree = page.build({ settingsStorage })
  return { tree, store }
}

function all(tree, type) {
  const out = []
  const walk = (n) => {
    if (!n || typeof n !== "object") return
    if (n.type === type) out.push(n)
    for (const c of n.children || []) walk(c)
  }
  walk(tree)
  return out
}
const texts = (tree) =>
  all(tree, "Text").flatMap((n) =>
    n.children.filter((c) => typeof c === "string"),
  )
const button = (tree, label) => {
  const b = all(tree, "Button").find((n) => n.props.label === label)
  if (!b) throw new Error(`no button "${label}"`)
  return b
}
const selectedChips = (tree) =>
  all(tree, "Button")
    .filter((b) => b.props.style && b.props.style.color === "#ffffff")
    .map((b) => b.props.label)

test("no Select dropdowns: every choice is a chip row with one selected", () => {
  const { tree } = render({})
  assert.equal(all(tree, "Select").length, 0)
  const on = selectedChips(tree)
  for (const want of [
    "min/km",
    "Pace",
    "Watch settings",
    "Text",
    "Auto",
    "2 columns",
    "3 columns",
  ])
    assert.ok(on.includes(want), `default "${want}" shown as selected`)
})

test("saved values are visible: chips, inputs and 'Saved:' lines", () => {
  const { tree } = render({
    pace_unit: "min_per_mile",
    target_metric: "power",
    target_power_low: "250",
    target_power_high: "270",
    hr_zone_method: "max",
    max_hr: "185",
    threshold_pace: "7:10",
    ftp: "290",
    license_key: "ABCD-1234-EFGH-5678",
  })
  const on = selectedChips(tree)
  assert.ok(on.includes("min/mi"))
  assert.ok(on.includes("Power"))
  assert.ok(on.includes("Max HR"))
  const inputs = Object.fromEntries(
    all(tree, "TextInput").map((n) => [n.props.settingsKey, n.props.value]),
  )
  assert.equal(inputs.target_power_low, "250")
  assert.equal(inputs.target_power_high, "270")
  assert.equal(inputs.max_hr, "185")
  assert.equal(inputs.threshold_pace, "7:10")
  assert.equal(inputs.ftp, "290")
  const t = texts(tree).join("|")
  assert.match(t, /Saved: 250 W/)
  assert.match(t, /Saved: 270 W/)
  assert.match(t, /Saved: 185 bpm/)
  assert.match(t, /Saved: 7:10 \/mi/)
  assert.match(t, /Saved: 290 W/)
  assert.match(t, /Saved: ABCD\.\.\.5678/)
})

test("unset text fields say so instead of looking blank", () => {
  const { tree } = render({})
  assert.ok(texts(tree).filter((x) => /Not set/.test(x)).length >= 3)
})

test("layout: current field per spot, picker opens, pick saves", () => {
  const layout = JSON.stringify({ slots: { r2c: "power" }, updated_at: 1 })
  let { tree, store } = render({ layout_json: layout })
  const center = all(tree, "Button").find((b) =>
    /^Center:\s+Power/.test(b.props.label),
  )
  assert.ok(center, "row 2 center shows its field")
  center.props.onClick()
  assert.equal(store.get("ui_open_slot"), "r2c")

  ;({ tree, store } = render(Object.fromEntries(store)))
  button(tree, "Time of day").props.onClick()
  const saved = JSON.parse(store.get("layout_json"))
  assert.equal(saved.slots.r2c, "clock")
  assert.ok(saved.updated_at > 1)
  assert.equal(store.get("ui_open_slot"), "")
})

test("layout: column chips change the row and its spots", () => {
  let { tree, store } = render({})
  const threes = all(tree, "Button").filter(
    (b) => b.props.label === "3 columns",
  )
  threes[0].props.onClick() // row 1
  ;({ tree, store } = render(Object.fromEntries(store)))
  assert.equal(JSON.parse(store.get("layout_json")).cols.r1, 3)
  assert.ok(
    all(tree, "Button").some((b) =>
      /^Middle:\s+% of max HR/.test(b.props.label),
    ),
  )
})

test("label style and zone bar chips save into the layout", () => {
  let { tree, store } = render({})
  button(tree, "Icons").props.onClick()
  ;({ tree, store } = render(Object.fromEntries(store)))
  button(tree, "Power zones").props.onClick()
  const saved = JSON.parse(store.get("layout_json"))
  assert.equal(saved.labels, "icons")
  assert.equal(saved.bar, "power")
})

test("enum chips write their key", () => {
  const { tree, store } = render({})
  button(tree, "min/mi").props.onClick()
  button(tree, "Threshold HR").props.onClick()
  assert.equal(store.get("pace_unit"), "min_per_mile")
  assert.equal(store.get("hr_zone_method"), "lthr")
})

test("top row has its own column chips and names its single spot", () => {
  const { tree } = render({})
  assert.ok(
    all(tree, "Button").some((b) => /^Value:\s+Heart rate/.test(b.props.label)),
  )
  const ones = all(tree, "Button").filter((b) => b.props.label === "1 column")
  assert.ok(ones.length >= 1)
})

test("target: heart rate option and separate From / To fields per metric", () => {
  let { tree, store } = render({
    target_metric: "hr",
    target_hr_low: "150",
    target_hr_high: "160",
    target_pace_low: "4:40",
  })
  assert.ok(selectedChips(tree).includes("Heart rate"))
  const inputs = Object.fromEntries(
    all(tree, "TextInput").map((n) => [n.props.settingsKey, n.props.value]),
  )
  assert.equal(inputs.target_hr_low, "150")
  assert.equal(inputs.target_hr_high, "160")
  assert.equal(inputs.target_pace_low, undefined) // other metric not shown
  const t = texts(tree).join("|")
  assert.match(t, /From \(bpm\)/)
  assert.match(t, /Saved: 160 bpm/)

  button(tree, "Pace").props.onClick()
  ;({ tree, store } = render(Object.fromEntries(store)))
  const paceInputs = Object.fromEntries(
    all(tree, "TextInput").map((n) => [n.props.settingsKey, n.props.value]),
  )
  assert.equal(paceInputs.target_pace_low, "4:40") // pace range kept
})

test("no units or auto-lap settings: the watch owns both", () => {
  const { tree } = render({})
  const labels = all(tree, "Button").map((b) => b.props.label)
  assert.ok(!labels.includes("Hide"))
  assert.ok(!labels.some((l) => /^Every 1 /.test(l)))
})

const inputByPlaceholder = (tree, re) => {
  const n = all(tree, "TextInput").find((i) =>
    re.test(i.props.placeholder || ""),
  )
  if (!n) throw new Error(`no input ${re}`)
  return n
}

test("presets: save current, apply another, delete with confirmation", () => {
  let { tree, store } = render({
    target_metric: "pace",
    target_pace_low: "4:40",
    layout_json: JSON.stringify({ slots: { r2c: "pace" }, updated_at: 1 }),
  })
  inputByPlaceholder(tree, /Preset name/).props.onChange("Tempo")
  const [tempo] = JSON.parse(store.get("presets_json"))
  assert.equal(tempo.name, "Tempo")
  assert.equal(JSON.parse(store.get("preset_active")).id, tempo.id)
  ;({ tree, store } = render(Object.fromEntries(store)))
  assert.match(texts(tree).join("|"), /Tempo\|\s+Active/)

  // change layout + target, save as a second preset
  button(tree, "Heart rate").props.onClick()
  assert.ok(Number(store.get("target_at")) > 0, "target edits are stamped")
  store.set(
    "layout_json",
    JSON.stringify({ slots: { r2c: "hr" }, updated_at: 2 }),
  )
  ;({ tree, store } = render(Object.fromEntries(store)))
  assert.match(texts(tree).join("|"), /Active, changed since/)
  inputByPlaceholder(tree, /Preset name/).props.onChange("Easy")
  assert.equal(JSON.parse(store.get("presets_json")).length, 2)

  // apply Tempo again: layout and target come back
  ;({ tree, store } = render(Object.fromEntries(store)))
  button(tree, "Apply").props.onClick()
  assert.equal(store.get("target_metric"), "pace")
  assert.equal(JSON.parse(store.get("layout_json")).slots.r2c, "pace")
  assert.equal(JSON.parse(store.get("preset_active")).id, tempo.id)

  // delete asks first
  ;({ tree, store } = render(Object.fromEntries(store)))
  all(tree, "Button")
    .filter((b) => b.props.label === "Delete")[0]
    .props.onClick()
  assert.equal(JSON.parse(store.get("presets_json")).length, 2)
  ;({ tree, store } = render(Object.fromEntries(store)))
  button(tree, "Delete Tempo").props.onClick()
  assert.deepEqual(
    JSON.parse(store.get("presets_json")).map((p) => p.name),
    ["Easy"],
  )
  assert.equal(store.get("preset_active"), "")
})

test("export shows the settings as text; import previews, then replaces", () => {
  let { tree, store } = render({
    ftp: "300",
    license_key: "SECRET-KEY-1234",
  })
  button(tree, "Export settings").props.onClick()
  ;({ tree, store } = render(Object.fromEntries(store)))
  const exported = all(tree, "TextInput").find((i) =>
    /"app":"RunDeck"/.test(i.props.value || ""),
  )
  assert.ok(exported, "export text shown")
  assert.ok(!/SECRET/.test(exported.props.value))

  // bad paste: a reason, no import button
  inputByPlaceholder(tree, /Paste exported/).props.onChange("nonsense")
  ;({ tree, store } = render(Object.fromEntries(store)))
  assert.match(texts(tree).join("|"), /Can't import: Not a RunDeck export/)
  assert.ok(
    !all(tree, "Button").some((b) => b.props.label === "Import and replace"),
  )

  // good paste into a fresh phone
  ;({ tree, store } = render({ license_key: "OTHER-KEY", ftp: "200" }))
  inputByPlaceholder(tree, /Paste exported/).props.onChange(
    exported.props.value,
  )
  ;({ tree, store } = render(Object.fromEntries(store)))
  assert.match(texts(tree).join("|"), /Found 1 setting, 0 presets/)
  button(tree, "Import and replace").props.onClick()
  assert.equal(store.get("ftp"), "300")
  assert.equal(store.get("license_key"), "OTHER-KEY")
  assert.equal(store.get("ui_import_text"), "")
  ;({ tree, store } = render(Object.fromEntries(store)))
  assert.match(texts(tree).join("|"), /Imported 1 setting and 0 presets/)
})
