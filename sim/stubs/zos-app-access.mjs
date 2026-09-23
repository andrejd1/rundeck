// getSportData stub: answers from globalThis.__sim.sport[type], mirroring the
// documented callback shape ({code, data: JSON string of an object array}).
// Every call is tallied in __sim.sportReads[type] so tests can assert the
// polling cadence (each real call is an IPC and costs battery).
export function getSportData({ type }, callback) {
  const sim = (globalThis.__sim = globalThis.__sim || {})
  const reads = (sim.sportReads = sim.sportReads || {})
  reads[type] = (reads[type] || 0) + 1
  const sport = sim.sport || {}
  const d = sport[type]
  if (d === undefined) {
    callback({ code: 1, data: null })
    return false
  }
  callback({ code: 0, data: JSON.stringify([d]) })
  return true
}
