// Node ESM resolve hooks: map Zepp OS bare specifiers and the zeus-only
// `zosLoader:` scheme onto the headless stubs so the real widget code runs
// unmodified under Node.

const STUBS = {
  "@zos/ui": "./stubs/zos-ui.mjs",
  "@zos/utils": "./stubs/zos-utils.mjs",
  "@zos/sensor": "./stubs/zos-sensor.mjs",
  "@zos/storage": "./stubs/zos-storage.mjs",
  "@zos/fs": "./stubs/zos-fs.mjs",
  "@zos/device": "./stubs/zos-device.mjs",
  "@zos/app-access": "./stubs/zos-app-access.mjs",
  "@zos/interaction": "./stubs/zos-interaction.mjs",
  "@zos/page": "./stubs/zos-page.mjs",
  "@zos/router": "./stubs/zos-router.mjs",
  "@zos/user": "./stubs/zos-user.mjs",
  "@zeppos/zml/base-app": "./stubs/zml-base-app.mjs",
  "@zeppos/zml/base-page": "./stubs/zml-base-page.mjs",
  "@zeppos/zml/base-side": "./stubs/zml-base-side.mjs",
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("zosLoader:")) {
    // zosLoader:./index.[pf].layout.js -> ./index.r.layout.js (round target)
    return next(
      specifier.slice("zosLoader:".length).replace("[pf]", "r"),
      context,
    )
  }
  if (STUBS[specifier]) {
    return {
      url: new URL(STUBS[specifier], import.meta.url).href,
      shortCircuit: true,
    }
  }
  return next(specifier, context)
}
