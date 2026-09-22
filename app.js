// App entry. Wires zml messaging and receives phone pushes (config and
// license changes). app.js runs for every module of the mini program, so a
// push lands in the durable cache even while no run is on screen, and is
// handed to the live data screen when one is open.

import { BaseApp } from "@zeppos/zml/base-app"
import { normalizeConfig } from "./shared/config.js"
import { CONFIG_KEY, LICENSE_KEY, saveObject } from "./shared/device-store.js"
import { MSG } from "./shared/messages.js"

App(
  BaseApp({
    globalData: {},

    onCreate() {},

    onDestroy() {},

    onCall(data) {
      if (!data || data.method !== MSG.CONFIG_PUSH) return
      const params = data.params || {}
      const live = this.globalData.onConfigPush
      if (typeof live === "function") {
        // the open screen persists and applies it itself
        try {
          live(params)
          return
        } catch (e) {
          /* fall through to the cache */
        }
      }
      if (params.config) saveObject(CONFIG_KEY, normalizeConfig(params.config))
      if (typeof params.licensed === "boolean")
        saveObject(LICENSE_KEY, {
          licensed: params.licensed,
          checked_at: Date.now(),
        })
    },
  }),
)
