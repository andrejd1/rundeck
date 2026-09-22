// Headless stubs of the @zos/sensor classes the widget uses. Live values come
// from globalThis.__sim so scenarios can script them.

const sim = () => globalThis.__sim || {}

export class HeartRate {
  getCurrent() {
    return sim().hr != null ? sim().hr : 0
  }
  onCurrentChange() {}
  offCurrentChange() {}
}
