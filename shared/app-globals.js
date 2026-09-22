// Access to app.js's globalData from the data widget. Zepp OS exposes the app
// instance's options as `_options` — the same path zml itself uses — but the
// plain `globalData` shape is accepted too, which keeps the headless test
// harness from having to imitate runtime internals.

export function appGlobals() {
  try {
    const app = getApp()
    if (!app) return null
    if (app._options && app._options.globalData) return app._options.globalData
    return app.globalData || null
  } catch (e) {
    return null // no app instance in this runtime
  }
}
