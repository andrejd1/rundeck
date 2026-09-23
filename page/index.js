// On-watch layout editor (open RunDeck from the watch's app list). Two modes
// of the same page, switched with router.replace:
//   list: one button per screen slot (+ zone bar, reset), showing its field
//   pick: the field catalog for one slot; tapping a field saves and returns
// Edits land in the watch's layout copy (LAYOUT_KEY) with a fresh updated_at,
// so they beat the phone's copy until the phone changes the layout again,
// and are sent to the phone right away when it is in range.

import {
  BUTTON,
  COLORS,
  ERROR_TEXT,
  ROW,
  TITLE,
} from "zosLoader:./index.[pf].layout.js"
import { BasePage } from "@zeppos/zml/base-page"
import { replace } from "@zos/router"
import { createWidget, text_style, widget } from "@zos/ui"
import { normalizeConfig } from "../shared/config.js"
import {
  CONFIG_KEY,
  LAYOUT_KEY,
  loadObject,
  saveObject,
} from "../shared/device-store.js"
import {
  BAR_NAMES,
  BAR_OPTIONS,
  defaultLayout,
  FIELD_IDS,
  FIELD_NAMES,
  LABEL_STYLE_NAMES,
  LABEL_STYLES,
  newerLayout,
  ROWS,
  rowSlots,
  SLOTS,
} from "../shared/fields.js"
import { MSG } from "../shared/messages.js"

function parseParams(params) {
  if (!params) return {}
  if (typeof params === "object") return params
  try {
    return JSON.parse(params) || {}
  } catch (e) {
    return {}
  }
}

Page(
  BasePage({
    name: "layout.page",
    state: {},

    // The state object can outlive a replace() to this same page, so every
    // field is reset here rather than relying on its initial value.
    onInit(params) {
      this.state.mode = "list"
      this.state.slot = null
      this.state.y = 0
      this.state.error = null
      try {
        const p = parseParams(params)
        if (p.pick === "bar") this.state.mode = "bar"
        else if (SLOTS.some((s) => s.id === p.pick)) {
          this.state.mode = "pick"
          this.state.slot = p.pick
        }
        const cfg = normalizeConfig(loadObject(CONFIG_KEY))
        this.state.layout = newerLayout(cfg.layout, loadObject(LAYOUT_KEY))
      } catch (e) {
        this.state.error = e
      }
    },

    // Any failure is printed on the screen instead of leaving it black.
    build() {
      try {
        if (this.state.error) throw this.state.error
        const { mode } = this.state
        if (mode === "pick") this.buildPick()
        else if (mode === "bar") this.buildBar()
        else this.buildList()
      } catch (e) {
        this.showError(e)
      }
    },

    showError(e) {
      try {
        createWidget(widget.TEXT, {
          ...ERROR_TEXT,
          text_style: text_style.WRAP,
          text: `RunDeck editor error:\n${(e && e.message) || e}`,
        })
      } catch (_) {
        /* nothing left to draw with */
      }
    },

    // ---------------------------------------------------------------- views

    // Rows top to bottom: a column-count button (tap cycles through the
    // allowed counts) followed by the spots that count shows.
    buildList() {
      const { layout } = this.state
      const short = (id) => SLOTS.find((s) => s.id === id).short
      const slotButton = (id) =>
        this.button(`${short(id)}: ${FIELD_NAMES[layout.slots[id]]}`, () =>
          this.go({ pick: id }),
        )
      this.title("RunDeck layout")
      slotButton("header")
      for (const row of ROWS) {
        const cols = layout.cols[row.id]
        this.button(
          `${row.name}: ${cols} col${cols > 1 ? "s" : ""}`,
          () => {
            const next =
              row.cols[(row.cols.indexOf(cols) + 1) % row.cols.length]
            this.save({
              ...layout,
              cols: { ...layout.cols, [row.id]: next },
              updated_at: Date.now(),
            })
            this.go({})
          },
          COLORS.row,
        )
        for (const id of rowSlots(row.id, cols)) slotButton(id)
      }
      this.button(`Labels: ${LABEL_STYLE_NAMES[layout.labels]}`, () => {
        const i = LABEL_STYLES.indexOf(layout.labels)
        this.save({
          ...layout,
          labels: LABEL_STYLES[(i + 1) % LABEL_STYLES.length],
          updated_at: Date.now(),
        })
        this.go({})
      })
      this.button(`Zone bar: ${BAR_NAMES[layout.bar]}`, () =>
        this.go({ pick: "bar" }),
      )
      this.button(
        "Reset to default",
        () => {
          this.save({ ...defaultLayout(), updated_at: Date.now() })
          this.go({})
        },
        COLORS.danger,
      )
      this.pad()
    },

    buildPick() {
      const { layout, slot } = this.state
      const name = SLOTS.find((s) => s.id === slot).name
      this.title(name)
      this.button("< Back", () => this.go({}), COLORS.muted)
      for (const id of FIELD_IDS) {
        const current = layout.slots[slot] === id
        this.button(
          FIELD_NAMES[id],
          () => {
            this.save({
              ...layout,
              slots: { ...layout.slots, [slot]: id },
              updated_at: Date.now(),
            })
            this.go({})
          },
          current ? COLORS.selected : COLORS.button,
        )
      }
      this.pad()
    },

    buildBar() {
      const { layout } = this.state
      this.title("Zone bar")
      this.button("< Back", () => this.go({}), COLORS.muted)
      for (const id of BAR_OPTIONS) {
        this.button(
          BAR_NAMES[id],
          () => {
            this.save({ ...layout, bar: id, updated_at: Date.now() })
            this.go({})
          },
          layout.bar === id ? COLORS.selected : COLORS.button,
        )
      }
      this.pad()
    },

    // --------------------------------------------------------------- helpers

    save(layout) {
      this.state.layout = layout
      saveObject(LAYOUT_KEY, layout)
      try {
        this.call({ method: MSG.LAYOUT_UPDATE, params: { layout } })
      } catch (e) {
        /* phone away: the run screen hands it over on its next sync */
      }
    },

    go(params) {
      replace({ url: "page/index", params: JSON.stringify(params) })
    },

    title(text) {
      createWidget(widget.TEXT, { ...TITLE, text })
      this.state.y = TITLE.y + TITLE.h + ROW.gap
    },

    button(text, onClick, color = COLORS.button) {
      createWidget(widget.BUTTON, {
        ...BUTTON,
        y: this.state.y,
        text,
        normal_color: color,
        press_color: COLORS.pressed,
        click_func: onClick,
      })
      this.state.y += BUTTON.h + ROW.gap
    },

    // room to scroll the last button up to the middle of a round screen
    pad() {
      createWidget(widget.FILL_RECT, {
        x: 0,
        y: this.state.y,
        w: 1,
        h: ROW.bottomPad,
        color: 0x000000,
      })
    },
  }),
)
