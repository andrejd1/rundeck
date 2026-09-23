// @zos/device stub: a fixed round 480px device with a stable uuid.
export function getDeviceInfo() {
  const sim = globalThis.__sim || {}
  return {
    width: 480,
    height: 480,
    screenShape: 1,
    deviceName: "Sim",
    deviceSource: 0,
    uuid: sim.deviceUuid || "sim-device-uuid-0000000000000000",
  }
}
