// px() scales design pixels (designWidth 480) to the simulated screen, set
// with SIM_SCREEN (default 480, where px is identity).
export const SCREEN = Number(process.env.SIM_SCREEN) || 480
export const px = (v) => Math.round((v * SCREEN) / 480)
