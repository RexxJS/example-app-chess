#!/bin/sh
# tools/check-headers.sh -- every file under app/chess/ that is a port of
# the old engine names its origin: its header (the first 15 lines) says
# which src/<name>.js it came from and keeps Kaj Björklund's copyright
# (LICENSE, LICENSING.md). The RexxJS bundle must say it is generated. A
# file that is not a port is not checked. Exits non-zero naming each
# failure.
#
#   tools/check-headers.sh [dir]     (default app/chess)
ROOT=$(cd "$(dirname "$0")/.." && pwd)
DIR=${1:-$ROOT/app/chess}
PORTS="chess bitboard zobrist move position parser ai"
status=0
for name in $PORTS; do
    f="$DIR/$name.ts"
    [ -f "$f" ] || continue
    head=$(head -15 "$f")
    case "$head" in
        *"src/$name.js"*) ;;
        *) echo "check-headers: $f does not name its origin src/$name.js"; status=1 ;;
    esac
    case "$head" in
        *"Kaj Björklund"*) ;;
        *) echo "check-headers: $f does not keep Kaj Björklund's copyright"; status=1 ;;
    esac
done
if [ -f "$DIR/rexxjs.js" ]; then
    case "$(head -2 "$DIR/rexxjs.js")" in
        *GENERATED*RexxJS*|*GENERATED*) ;;
        *) echo "check-headers: $DIR/rexxjs.js does not say it is generated"; status=1 ;;
    esac
fi
[ $status -eq 0 ] && echo "check-headers: ok"
exit $status
