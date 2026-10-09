#!/usr/bin/env bash
# Build RunDeck for one watch, several, or every product in manifest.xml.
#
#   tools/build.sh fr965                 bin/fr965/RunDeck.prg (side-load or simulator)
#   tools/build.sh fr965 fenix7 fr255    several
#   tools/build.sh all                   every product (4 at a time), stops on the first failure
#   tools/build.sh package               bin/RunDeck.iq for the Connect IQ store
#   tools/build.sh test [device]         unit tests (test/), run in the simulator
#                                        (start it first: connectiq &)
#
# Environment:
#   CIQ_SDK   the SDK folder (default: the SDK Manager's current SDK)
#   DEV_KEY   developer key, DER (default: ~/.Garmin/developer_key.der).
#             Make one: openssl genrsa -out key.pem 4096 &&
#             openssl pkcs8 -topk8 -inform PEM -outform DER -in key.pem -out developer_key.der -nocrypt
#             Keep the store key safe: the store only accepts updates signed with it.
#   JOBS      parallel builds for "all" (default 4)
#
# Builds type-check strictly (-l 3) and treat warnings as information.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${CIQ_SDK:-}" ]; then
  cfg="$HOME/.Garmin/ConnectIQ/current-sdk.cfg"
  if [ -f "$cfg" ]; then
    CIQ_SDK="$(tr -d '\r\n' < "$cfg")"
  fi
fi
if [ -z "${CIQ_SDK:-}" ] || [ ! -f "$CIQ_SDK/bin/monkeybrains.jar" ]; then
  echo "Set CIQ_SDK to the Connect IQ SDK folder (the one with bin/monkeybrains.jar)." >&2
  exit 2
fi
DEV_KEY="${DEV_KEY:-$HOME/.Garmin/developer_key.der}"
if [ ! -f "$DEV_KEY" ]; then
  echo "No developer key at $DEV_KEY (set DEV_KEY)." >&2
  exit 2
fi
JAR="$CIQ_SDK/bin/monkeybrains.jar"

build() {
  local dev=$1
  mkdir -p "bin/$dev"
  if java -Xms512m -jar "$JAR" -o "bin/$dev/RunDeck.prg" -f monkey.jungle -y "$DEV_KEY" \
      -d "$dev" -l 3 -w > "bin/$dev/build.log" 2>&1; then
    echo "ok    $dev"
  else
    echo "FAIL  $dev" >&2
    grep -E "ERROR" "bin/$dev/build.log" | head -20 >&2
    return 1
  fi
}

case "${1:-}" in
  "")
    sed -n '2,20p' "$0"
    exit 2
    ;;
  package)
    mkdir -p bin
    java -Xms1g -jar "$JAR" -e -r -o bin/RunDeck.iq -f monkey.jungle -y "$DEV_KEY" -l 3 -w
    echo "bin/RunDeck.iq"
    ;;
  test)
    dev="${2:-fr965}"
    mkdir -p bin
    java -Xms512m -jar "$JAR" -o bin/test.prg -f monkey.jungle -y "$DEV_KEY" -d "$dev" -l 3 --unit-test
    "$CIQ_SDK/bin/monkeydo" bin/test.prg "$dev" -t
    ;;
  all)
    export -f build
    export JAR DEV_KEY
    grep -o '<iq:product id="[^"]*"' manifest.xml | cut -d'"' -f2 \
      | xargs -P "${JOBS:-4}" -I{} bash -c 'build {}'
    ;;
  *)
    for dev in "$@"; do
      build "$dev"
    done
    ;;
esac
