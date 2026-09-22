const store = new Map()

export const localStorage = {
  getItem: (k, d) => (store.has(k) ? store.get(k) : d != null ? d : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}
