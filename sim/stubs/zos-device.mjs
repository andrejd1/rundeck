// @zos/device stub: a round device (SIM_SCREEN px, default 480) with a
// stable uuid.
import { SCREEN } from "./zos-utils.mjs"

export function getDeviceInfo() {
  const sim = globalThis.__sim || {}
  return {
    width: SCREEN,
    height: SCREEN,
    screenShape: 1,
    deviceName: "Sim",
    deviceSource: 0,
    uuid: sim.deviceUuid || "sim-device-uuid-0000000000000000",
  }
}
