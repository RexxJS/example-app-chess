#!/bin/sh
# tests/specs/second_app.sh -- a second chess app beside the one sae-driver
# runs, for a spec that drives two (spec_app_chess_match, TODO.md 6.1):
#
#   tests/specs/second_app.sh <data dir> <command...>
#
# starts sae (no driver: no fixed port) on app/ with its control bus on,
# headless, its data folder (where its courier file goes) and storage
# under <data dir>; waits for its courier file; runs the command with
# CHESS_BLACK_DIR=<data dir>; stops the app; exits with the command's
# status. SAE_DIR is the sae checkout (run-tests.sh sets it).
DIR=$1
shift
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SAE=${SAE_DIR:-$ROOT/sae}
rm -rf "$DIR"
mkdir -p "$DIR/storage"
AETHER_UI_HEADLESS=1 SAE_APPDATA_DIR="$DIR" SAE_STORAGE_DIR="$DIR/storage" \
    "$SAE/target/build/bin/sae" --app "$ROOT/app" --control-bus >"$DIR/app.log" 2>&1 &
APP=$!
trap 'kill $APP 2>/dev/null; wait $APP 2>/dev/null' EXIT INT TERM
i=0
while [ ! -f "$DIR/.control-bus" ]; do
    i=$((i + 1))
    if [ $i -gt 100 ] || ! kill -0 $APP 2>/dev/null; then
        echo "second_app.sh: the second app did not start (its log: $DIR/app.log)" >&2
        cat "$DIR/app.log" >&2
        exit 1
    fi
    sleep 0.1
done
CHESS_BLACK_DIR="$DIR" "$@"
