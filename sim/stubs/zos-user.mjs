// @zos/user stub: profile from __sim.profile (age 0 = no data).
export function getProfile() {
  const sim = globalThis.__sim || {}
  return {
    age: 0,
    height: 0,
    weight: 0,
    gender: 2,
    nickName: "",
    region: "",
    ...(sim.profile || {}),
  }
}
