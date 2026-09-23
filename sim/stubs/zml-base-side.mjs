// ZML BaseSideService stub for Node tests. AppSideService just stores the
// service object so tests can call its methods directly.

export function BaseSideService(service) {
  return {
    // Outbound push to the watch. Recorded in __sim.sideCalls; a test can make
    // it fail by setting __sim.sideCallFails.
    call(data) {
      const sim = (globalThis.__sim = globalThis.__sim || {})
      sim.sideCalls = sim.sideCalls || []
      sim.sideCalls.push(data)
      if (sim.sideCallFails) return Promise.reject(new Error("ble disconnect"))
      return Promise.resolve()
    },
    ...service,
  }
}

export function AppSideService(service) {
  globalThis.__sideService = service
  return service
}
