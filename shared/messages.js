// Watch <-> phone message names (zml request/call `method`).
export const MSG = {
  // watch -> phone request: {device_uuid, trial_used} -> {code, config,
  // licensed, trial_used}
  GET_CONFIG: "GET_CONFIG",
  // watch -> phone call: {trial_used} after a run was counted
  TRIAL_REPORT: "TRIAL_REPORT",
  // phone -> watch call: {config, licensed} when settings or the license change
  CONFIG_PUSH: "CONFIG_PUSH",
}
