// Headless stub of @zos/ui: records every widget and property update so the
// harness can render the screen off-device.

export const __widgets = []

export const widget = {
  FILL_RECT: "FILL_RECT",
  STROKE_RECT: "STROKE_RECT",
  TEXT: "TEXT",
  BUTTON: "BUTTON",
  IMG: "IMG",
  IMG_LEVEL: "IMG_LEVEL",
  SPORT_DATA: "SPORT_DATA",
}

export const prop = {
  TEXT: "text",
  MORE: "more",
  VISIBLE: "visible",
}

export const align = {
  LEFT: "left",
  RIGHT: "right",
  CENTER_H: "center_h",
  TOP: "top",
  BOTTOM: "bottom",
  CENTER_V: "center_v",
}

export const text_style = {
  NONE: "none",
  WRAP: "wrap",
  CHAR_WRAP: "char_wrap",
  ELLIPSIS: "ellipsis",
}

// SPORT_DATA type constants: the stub uses the names themselves, so tests
// and the preview can read which native value a widget shows.
export const sport_data = new Proxy({}, { get: (_, name) => name })
export const edit_widget_group_type = { SPORTS: "SPORTS" }

// Not every firmware has getTextLayout; the stub leaves it out so the
// widget's fallback width estimate is what the tests exercise.
export const getTextLayout = undefined

export function deleteWidget(w) {
  const i = __widgets.indexOf(w)
  if (i >= 0) __widgets.splice(i, 1)
}

export function createWidget(type, props = {}) {
  const w = {
    type,
    props: { visible: true, ...props },
    setProperty(p, v) {
      if (p === prop.TEXT) this.props.text = v
      else if (p === prop.VISIBLE) this.props.visible = !!v
      else if (p === prop.MORE) Object.assign(this.props, v)
    },
  }
  __widgets.push(w)
  return w
}

export function __resetWidgets() {
  __widgets.length = 0
}
