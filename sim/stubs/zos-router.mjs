// @zos/router stub: navigation is recorded in __sim.navigation.
const nav = () => {
  const sim = (globalThis.__sim = globalThis.__sim || {})
  sim.navigation = sim.navigation || []
  return sim.navigation
}
export function push(option) {
  nav().push({ type: "push", ...option })
}
export function replace(option) {
  nav().push({ type: "replace", ...option })
}
export function back() {
  nav().push({ type: "back" })
}
