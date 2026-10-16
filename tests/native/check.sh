#!/bin/sh
# tests/native/check.sh -- the native engine (app/native/engine.ae, TODO.md 4.4)
# built with `ae` and held to the TypeScript one:
#   - perft, from the start to 5 and the standard test positions, the node
#     counts exact (the move generator's oracle, as chess_position's);
#   - the suite of tests/headless/chess_native_reference.ts (its SUITE
#     entries), each search's line (move, value, depth, ties, nodes,
#     positions evaluated) the same as the TypeScript engine's there (its
#     "// expect:" lines), node for node;
#   - timed: level 4 on Kiwipete (seconds for the TypeScript engine on QuickJS)
#     within a budget of 2 s, and the speed said.
# One line per check; exits non-zero when any fails.
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
BIN=$ROOT/target/chess-engine
REF=$ROOT/tests/headless/chess_native_reference.ts
command -v ae >/dev/null 2>&1 || { echo "FAIL native: no ae on PATH"; exit 2; }
mkdir -p "$ROOT/target"
ae build "$ROOT/native/cli.ae" --lib "$ROOT/app/native" -o "$BIN" >"$ROOT/target/chess-engine.build.log" 2>&1 || {
    echo "FAIL native: the build (target/chess-engine.build.log)"; cat "$ROOT/target/chess-engine.build.log"; exit 1; }
fail=0
check() {  # label, got, want
    if [ "$2" = "$3" ]; then echo "ok $1"; else echo "FAIL $1: got $2, want $3"; fail=1; fi
}
perft() { "$BIN" perft "$1" "$2" | sed 's/^nodes=\([0-9]*\).*/\1/'; }
check "perft 5 from the start" "$(perft 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' 5)" 4865609
check "Kiwipete perft 4" "$(perft 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1' 4)" 4085603
check "position 3 perft 5" "$(perft '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1' 5)" 674624
check "position 4 perft 4" "$(perft 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1' 4)" 422333
check "position 5 perft 4" "$(perft 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8' 4)" 2103487
check "position 6 perft 4" "$(perft 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10' 4)" 3894594
# Chess960 (TODO.md 6.5), from the published Chess960 perft lists, as chess_960 has them in TypeScript.
check "Chess960 bqnb1rkr/... HFhf perft 4" "$(perft 'bqnb1rkr/pp3ppp/3ppn2/2p5/5P2/P2P4/NPP1P1PP/BQ1BNRKR w HFhf - 2 9' 4)" 326672
check "Chess960 2nnrbkr/... HEhe perft 4" "$(perft '2nnrbkr/p1qppppp/8/1ppb4/6PP/3PP3/PPP2P2/BQNNRBKR w HEhe - 1 9' 4)" 667366
# The capability check sae's natives make (docs/natives.md): the engine computes, and reaches nothing.
if ae inspect "$ROOT/app/native/engine.ae" | grep -q "capabilities required: none (capability-empty)"; then echo "ok the engine module is capability-empty"; else echo "FAIL the engine module needs a capability"; fail=1; fi
# The suite: each SUITE entry's line against the reference's expect line in turn.
sed -n 's/^  \["\([^"]*\)", \([0-9]*\), \([0-9]*\)\],$/\1|\2|\3/p' "$REF" > "$ROOT/target/native-suite.txt"
sed -n 's|^// expect: ||p' "$REF" > "$ROOT/target/native-want.txt"
n=$(wc -l < "$ROOT/target/native-suite.txt" | tr -d ' ')
[ "$n" -gt 0 ] && [ "$n" -eq "$(wc -l < "$ROOT/target/native-want.txt" | tr -d ' ')" ] || { echo "FAIL native: the suite has $n entries and not as many expect lines"; exit 1; }
i=0
while IFS='|' read -r fen depth seed; do
    i=$((i + 1))
    got=$("$BIN" search "$fen" "$depth" "$seed" | sed 's/ ms=[0-9]*$//')
    want=$(sed -n "${i}p" "$ROOT/target/native-want.txt")
    check "as the TypeScript engine: $fen at depth $depth" "$got" "$want"
done < "$ROOT/target/native-suite.txt"
# Timed.
line=$("$BIN" bench 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1' 4 | sort -t= -k8 -n | head -1)
ms=$(echo "$line" | sed 's/.* ms=\([0-9]*\)$/\1/')
nodes=$(echo "$line" | sed 's/.* nodes=\([0-9]*\) .*/\1/')
if [ "$ms" -lt 2000 ]; then echo "ok level 4 on Kiwipete in ${ms} ms, within 2 s (${nodes} nodes, as the TypeScript engine searches, which takes seconds on QuickJS)"; else echo "FAIL level 4 on Kiwipete took ${ms} ms, over 2 s"; fail=1; fi
exit $fail
