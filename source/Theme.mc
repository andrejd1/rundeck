// Colors. Pure black background by default (AMOLED pixels off); watches
// with a white data field background (a display setting on many MIP
// watches) get the same layout in darker inks.

import Toybox.Lang;

module Theme {
    // label colors per field group: hr, pace, time, dist, body
    const GROUP_DARK as Array<Number> = [0xef4444, 0x60a5fa, 0x22c55e, 0xf59e0b, 0x2dd4bf];
    const GROUP_LIGHT as Array<Number> = [0xc81e1e, 0x1d4ed8, 0x15803d, 0xb45309, 0x0f766e];

    function bg(dark as Boolean) as Number {
        return dark ? 0x000000 : 0xffffff;
    }

    function fg(dark as Boolean) as Number {
        return dark ? 0xffffff : 0x000000;
    }

    function divider(dark as Boolean) as Number {
        return dark ? 0x3a3a3a : 0xb0b0b0;
    }

    function notice(dark as Boolean) as Number {
        return dark ? 0xf59e0b : 0xb45309;
    }

    function group(g as Number, dark as Boolean) as Number {
        return dark ? GROUP_DARK[g] : GROUP_LIGHT[g];
    }

    // a value against the target: blue below, green inside, red above
    function target(status as Number, dark as Boolean) as Number {
        if (status == Target.BELOW) {
            return dark ? 0x60a5fa : 0x1d4ed8;
        }
        if (status == Target.ABOVE) {
            return dark ? 0xef4444 : 0xc81e1e;
        }
        return dark ? 0x2ee66b : 0x15803d;
    }
}
