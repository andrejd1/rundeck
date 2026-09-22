// zml BasePage stub: identity wrapper + a request() that resolves from the
// scripted scenario (globalThis.__sim.sideResponse) and a call() that records
// watch->phone messages (globalThis.__sim.sideCalls).
export const BasePage = (page) => ({
  request(req) {
    const fn = globalThis.__sim && globalThis.__sim.sideResponse
    if (!fn) return Promise.reject(new Error("no side service in sim"))
    return Promise.resolve(fn(req))
  },
  call(msg) {
    const sim = (globalThis.__sim = globalThis.__sim || {})
    sim.sideCalls = sim.sideCalls || []
    sim.sideCalls.push(msg)
    return Promise.resolve({ code: 0 })
  },
  ...page,
})
