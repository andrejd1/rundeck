// zml BaseApp stub: identity wrapper plus the messaging methods app.js relies
// on. `call` records outbound messages in __sim.appCalls and `request` answers
// from the scripted side service, exactly like the BasePage stub.

export const BaseApp = (app) => ({
  call(data) {
    const sim = (globalThis.__sim = globalThis.__sim || {})
    sim.appCalls = sim.appCalls || []
    sim.appCalls.push(data)
    return Promise.resolve()
  },
  request(req) {
    const fn = globalThis.__sim && globalThis.__sim.sideResponse
    if (!fn) return Promise.reject(new Error("no side service in sim"))
    return Promise.resolve(fn(req))
  },
  ...app,
})
