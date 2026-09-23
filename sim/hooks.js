// Node ESM resolve hooks: map Zepp OS bare specifiers and the zeus-only
// `zosLoader:` scheme onto the headless stubs so the real widget code runs
// unmodified under Node.

const STUBS = {
  "@zos/ui": "./stubs/zos-ui.js",
  "@zos/utils": "./stubs/zos-utils.js",
  "@zos/sensor": "./stubs/zos-sensor.js",
  "@zos/storage": "./stubs/zos-storage.js",
  "@zos/fs": "./stubs/zos-fs.js",
  "@zos/device": "./stubs/zos-device.js",
  "@zos/app-access": "./stubs/zos-app-access.js",
  "@zos/interaction": "./stubs/zos-interaction.js",
  "@zos/page": "./stubs/zos-page.js",
  "@zos/router": "./stubs/zos-router.js",
  "@zos/user": "./stubs/zos-user.js",
  "@zeppos/zml/base-app": "./stubs/zml-base-app.js",
  "@zeppos/zml/base-page": "./stubs/zml-base-page.js",
  "@zeppos/zml/base-side": "./stubs/zml-base-side.js",
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
