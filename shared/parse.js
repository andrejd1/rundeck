// Parsers for the string-typed values getSportData returns (see the
// "Live metrics input contract" section). Kept platform-free so they can be
// unit-tested off-device.

// "4'50''" / "4'50\"" / "4:50" -> seconds per pace unit (km or mile)
export function parsePaceString(str) {
  if (!str || typeof str !== "string") return null
  const m = str.match(/(\d+)\D+(\d{1,2})/)
  if (!m) return null
  const sec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
  return sec > 0 ? sec : null
}

// "1:15:15" / "15:15" -> seconds
export function parseDurationString(str) {
  if (!str || typeof str !== "string") return null
  const parts = str.split(":").map((p) => parseInt(p, 10))
  if (!parts.length || parts.some((p) => Number.isNaN(p))) return null
  let sec = 0
  for (const p of parts) sec = sec * 60 + p
  return sec
}
