// @zos/interaction stub: the registered onKey callback is exposed through
// globalThis.__sim.keyHandler so scenarios can synthesize physical key events.

export const KEY_BACK = 1
export const KEY_SELECT = 2
export const KEY_HOME = 3
export const KEY_UP = 4
export const KEY_DOWN = 5
export const KEY_SHORTCUT = 6

export const KEY_EVENT_CLICK = 10
export const KEY_EVENT_LONG_PRESS = 11
export const KEY_EVENT_DOUBLE_CLICK = 12
export const KEY_EVENT_PRESS = 13
export const KEY_EVENT_RELEASE = 14

export function onKey(option) {
  const cb = typeof option === "function" ? option : option && option.callback
  if (globalThis.__sim) globalThis.__sim.keyHandler = cb
}

export function offKey() {
  if (globalThis.__sim) globalThis.__sim.keyHandler = null
}
