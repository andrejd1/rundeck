// In-memory stub of the @zos/fs subset used by the durable store.

const files = new Map()

export function writeFileSync({ path, data }) {
  files.set(path, typeof data === "string" ? data : String(data))
}

export function readFileSync({ path, options } = {}) {
  if (!files.has(path)) return undefined
  const raw = files.get(path)
  return options && options.encoding ? raw : raw
}

export function rmSync(option) {
  const path = typeof option === "string" ? option : option && option.path
  files.delete(path)
}
