// What the watch would draw in each SPORT_DATA widget, for the preview and
// the screen checks. Values are on the long side (1:5x:xx time, 2-digit km,
// 3-digit HR) so the geometry checks see the widest text a run shows. A
// frame can override them with globalThis.__nativeSamples.
export const NATIVE_PREVIEW = {
  HR: "178",
  HR_AVG: "152",
  HR_CUR_SECTION: "161",
  HR_PREV_SECTION: "158",
  PACE: "5'38\"",
  PACE_AVG: "4'49\"",
  PACE_CUR_AVG: "4'52\"",
  PACE_PREV_AVG: "4'47\"",
  SPEED: "12.4",
  DEVICE_POWER: "388",
  DEVICE_AVG_POWER: "244",
  DEVICE_LAP_AVG_POWER: "251",
  DURATION_NET: "1:52:13",
  DURATION_CUR_SECTION: "04:21",
  DURATION_PREV_SECTION: "04:47",
  OTHER_CUR_TIME: "07:05",
  DISTANCE_TOTAL: "18.34",
  DISTANCE_CUR_SECTION: "0.34",
  OTHER_SECTION_ORDER: "19",
  SLOPE: "-3%",
  ALTITUDE_TOTAL_UP: "115",
  ALTITUDE: "212",
  STRIDE_FREQ: "178",
  STRIDE_AVG_FREQ: "171",
  CONSUME: "1024",
  ALTITUDE_TOTAL_DOWN: "112",
  ALTITUDE_CUR_UP: "12",
  ALTITUDE_CUR_DOWN: "8",
  ALTITUDE_MAX: "248",
  SPEED_VERTICAL: "320",
  SPEED_MAX: "18.2",
  STRIDE: "1.12",
  STRIDE_AVG: "1.08",
  STRIDE_COUNT: "15016",
  HR_MAX_PERCENT: "84%",
  HR_RESERVED_PERCENT: "78%",
  OTHER_AEROBIC_TE: "3.4",
  OTHER_ANAEROBIC_TE: "1.2",
  OTHER_TRAIN_LOAD: "86",
  TEMP: "18",
  OTHER_SUNSET_TIME: "19:42",
  OTHER_SUNRISE_TIME: "06:48",
  HR_AVG_MAX_PERCENT: "79%",
  HR_CUR_MAX_PERCENT: "86%",
  SPEED_AVG: "12.1",
  SPEED_CUR_SECTION: "12.3",
  SPEED_PREV_SECTION: "12.5",
  DEVICE_MAX_POWER: "512",
  DEVICE_PREV_AVG_POWER: "248",
  DEVICE_3S_AVG_POWER: "262",
  DEVICE_10S_AVG_POWER: "255",
  DEVICE_30S_AVG_POWER: "249",
  DEVICE_POWER_WEIGHT: "3.6",
  DEVICE_WORK: "1402",
  DURATION_AVG_SECTION: "04:49",
  DISTANCE_PREV_SECTION: "1.00",
  SLOPE_CUR: "2%",
  SLOPE_AVG: "1%",
  ALTITUDE_PREV_UP: "14",
  ALTITUDE_PREV_DOWN: "9",
  ALTITUDE_MIN: "188",
  STRIDE_CUR_FREQ: "176",
  STRIDE_PREV_FREQ: "174",
  STRIDE_CUR: "1.10",
}

// Workout time and heart rate follow the simulated run, so a frame shows
// what the watch would at that moment (sizes depend on the elapsed time).
function live(type) {
  const sim = globalThis.__sim || {}
  if (type === "DURATION_NET") {
    const d = sim.sport && sim.sport.duration && sim.sport.duration.duration
    const sec =
      typeof d === "string"
        ? d.split(":").reduce((a, v) => a * 60 + +v, 0)
        : null
    if (!(sec > 0)) return null
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const pad = (n) => String(n).padStart(2, "0")
    return h ? `${h}:${pad(m)}:${pad(sec % 60)}` : `${m}:${pad(sec % 60)}`
  }
  if (type === "HR" && sim.hr > 0) return String(sim.hr)
  return null
}

export function nativeText(type) {
  const own = globalThis.__nativeSamples || {}
  return own[type] || live(type) || NATIVE_PREVIEW[type] || "--"
}
