#!/usr/bin/env python3
"""Stand-in Connect IQ device files for compiling without the SDK Manager.

The SDK Manager only downloads device files after a Garmin account login,
which a CI runner (or a sandbox) doesn't have. The compiler needs just a
device's compiler.json, and everything in it except the API level is printed
in the SDK's own device reference (doc/docs/Device_Reference/<id>.html), so
this writes one compiler.json per product in manifest.xml from those pages.

These files are good for type-checking and building only: no simulator.json,
no fonts, so the simulator can't run them. Release builds should use the real
device files from the SDK Manager.

usage: stub-devices.py <sdk-dir> [manifest.xml] [devices-dir]
"""

import html
import json
import os
import re
import sys

# The device reference doesn't print the API level. Firmware as of 2025;
# a device not listed gets DEFAULT_API. Only the type checker reads it.
API = {
    "fr745": "3.3.0", "fr945": "3.3.0", "fr945lte": "3.3.0", "fr245m": "3.3.0",
    "fenix5plus": "3.3.0", "fenix5splus": "3.3.0", "fenix5xplus": "3.3.0",
    "fenix6pro": "3.4.0", "fenix6spro": "3.4.0", "fenix6xpro": "3.4.0",
    "marqadventurer": "3.4.0", "marqathlete": "3.4.0", "marqaviator": "3.4.0",
    "marqcaptain": "3.4.0", "marqcommander": "3.4.0", "marqdriver": "3.4.0",
    "marqexpedition": "3.4.0", "marqgolfer": "3.4.0",
    "descentmk2": "3.4.0", "descentmk2s": "3.4.0",
    "venu2": "4.2.0", "venu2plus": "4.2.0", "venu2s": "4.2.0",
    "d2airx10": "4.2.0",
}
DEFAULT_API = "5.1.0"

# RGB222: the 64-color palette of the transflective (MIP) displays
PALETTE64 = [
    "%02X%02X%02X" % (r * 85, g * 85, b * 85)
    for r in range(4)
    for g in range(4)
    for b in range(4)
]


def page_lines(path):
    t = open(path, encoding="utf-8").read()
    t = re.sub(r"<script.*?</script>", "", t, flags=re.S)
    t = re.sub(r"<style.*?</style>", "", t, flags=re.S)
    t = html.unescape(re.sub(r"<[^>]+>", "\n", t))
    return [l.strip() for l in t.split("\n") if l.strip()]


def after(lines, key, start=0):
    try:
        return lines[lines.index(key, start) + 1]
    except ValueError:
        return None


def device(sdk, dev_id):
    path = os.path.join(sdk, "doc", "docs", "Device_Reference", dev_id + ".html")
    lines = page_lines(path)
    start = lines.index("Attribute")
    w, h = [int(v) for v in after(lines, "Screen Size", start).split("x")]
    colors = int(after(lines, "Display Colors", start))
    iw, ih = [int(v) for v in after(lines, "Launcher Icon Size", start).split("x")]
    text = " | ".join(lines)
    app_types = []
    for name, json_type in [
        ("Data Field", "datafield"),
        ("Watch App", "watchApp"),
        ("Background", "background"),
    ]:
        try:
            i = lines.index(name, start)
            app_types.append({"type": json_type, "memoryLimit": int(lines[i + 1])})
        except (ValueError, IndexError):
            pass
    parts = re.findall(r"Part Number (\d{3}-[A-Z0-9]+-\d\d)", text) or ["006-B0000-00"]
    api = API.get(dev_id, DEFAULT_API)
    out = {
        "deviceId": dev_id,
        "displayName": lines[start - 1],
        "deviceFamily": "%s-%dx%d" % (after(lines, "Screen Shape", start), w, h),
        "worldWidePartNumber": parts[0],
        "partNumbers": [
            {
                "connectIQVersion": api,
                "number": p,
                "firmwareVersion": 100,
                "languages": [{"code": "eng", "fontSet": "ww"}],
            }
            for p in dict.fromkeys(parts)
        ],
        "orientation": 0,
        "bitsPerPixel": 16 if colors > 256 else 8,
        "resolution": {"width": w, "height": h},
        "appTypes": app_types,
        "launcherIcon": {"width": iw, "height": ih},
    }
    if colors <= 256:
        out["palette"] = {"colors": PALETTE64}
    return out


def products(manifest):
    return re.findall(r'<iq:product id="([^"]+)"', open(manifest).read())


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    sdk = sys.argv[1]
    manifest = sys.argv[2] if len(sys.argv) > 2 else "manifest.xml"
    dest = (
        sys.argv[3]
        if len(sys.argv) > 3
        else os.path.expanduser("~/.Garmin/ConnectIQ/Devices")
    )
    for dev_id in products(manifest):
        d = device(sdk, dev_id)
        os.makedirs(os.path.join(dest, dev_id), exist_ok=True)
        with open(os.path.join(dest, dev_id, "compiler.json"), "w") as f:
            json.dump(d, f, indent=2)
        print(dev_id, d["deviceFamily"], d["partNumbers"][0]["connectIQVersion"])


if __name__ == "__main__":
    main()
