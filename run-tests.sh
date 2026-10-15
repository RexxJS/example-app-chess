#!/bin/sh
# run-tests.sh -- the chess app's tests, on the sae checked out beside this
# one (./sae -> ../sae, built as its AGENTS.md "Build and test" says:
# ./build.sh, AETHER_UI_WITH_DRIVER=1 ./build.sh, target/pageserver,
# target/saelower and target/saejs). One line of PASS/FAIL apiece, a log per
# run under target/run-tests/; exits non-zero when any fails.
#
#   ./run-tests.sh                 everything
#   ./run-tests.sh headless        only the headless tests (no window)
#   ./run-tests.sh spec_app_       only the entries whose label contains it
#
#   SAE_DIR=/elsewhere/sae ./run-tests.sh    another sae checkout
#
# headers: tools/check-headers.sh, every port under app/chess names its
# origin (LICENSING.md). headless: tests/headless/*.ts, the engine, the game and the commands with
# no ui, run by sae's lowerer harness (sae/lower/run-tests.sh --mod) on
# sae's QuickJS. The specs (tests/specs/) drive the app in sae-driver
# through sae's tests/run_spec.sh, with this repo's tests/lib first on the
# module path. The REXX scripts' spec (when it comes) runs on node and the
# RexxJS beside this checkout (./RexxJS -> ../RexxJS). On Linux with no
# display it reruns itself under xvfb-run.
ROOT=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT" || exit 1
SAE=$(cd "${SAE_DIR:-$ROOT/sae}" 2>/dev/null && pwd -P) || {
    echo "run-tests.sh: no sae at ${SAE_DIR:-$ROOT/sae} (check out aether-lang-dev/sae-it-aint-so beside this repo)" >&2
    exit 2
}
FILTER=${1:-}
if [ "$(uname -s)" = Linux ] && [ -z "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] \
   && [ -z "${CHESS_RUN_XVFB:-}" ] && command -v xvfb-run >/dev/null 2>&1; then
    CHESS_RUN_XVFB=1 exec xvfb-run -a sh "$0" "$@"
fi
for f in target/build/bin/sae-driver target/pageserver target/saelower target/saejs; do
    [ -x "$SAE/$f" ] || { echo "run-tests.sh: no $SAE/$f (sae's AGENTS.md \"Build and test\")" >&2; exit 2; }
done

T=$ROOT/target
LOGS=$T/run-tests
rm -rf "$LOGS" "$T/chess-appdata"; mkdir -p "$LOGS"
# label | environment (space-separated NAME=value) | command
TABLE="
headers||headers
headless||headless
spec_app_chess|AETHER_UI_HEADLESS=1 SAE_APPDATA_DIR=$T/chess-appdata SAE_TEST_APP=$ROOT/app|spec spec_app_chess
"

pass=0; fail=0; failed=""
old_ifs=$IFS
IFS='
'
for line in $TABLE; do
    IFS=$old_ifs
    label=${line%%|*}; rest=${line#*|}
    envs=${rest%%|*}; cmd=${rest#*|}
    case "$label" in *"$FILTER"*) ;; *) IFS='
'; continue ;; esac
    log="$LOGS/$label.log"
    set -- $cmd
    case "$1" in
        headers) set -- "$ROOT/tools/check-headers.sh" ;;
        headless) set -- env SAE_LOWER_OUT="$T/lower-tests" "$SAE/lower/run-tests.sh" --mod "$ROOT/tests/headless" ;;
        spec) set -- env SAE_TEST_LIB_DIR="$ROOT/tests/lib" \
                  "$SAE/tests/run_spec.sh" "$ROOT/tests/specs/$2.ae" "$ROOT/app" ;;
    esac
    # shellcheck disable=SC2086 -- envs is a list of NAME=value words
    if env $envs "$@" >"$log" 2>&1; then
        echo "PASS $label"; pass=$((pass + 1))
    else
        echo "FAIL $label (log: $log)"; fail=$((fail + 1)); failed="$failed $label"
    fi
    IFS='
'
done
IFS=$old_ifs
echo "$pass passed, $fail failed${failed:+:$failed}"
[ "$fail" -eq 0 ]
