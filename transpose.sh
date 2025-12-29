#!/usr/bin/env bash

export LC_NUMERIC="en_US.UTF-8"

if [ $# -lt 2 ]; then
    echo "Usage: $0 <source.wav> <root_note> [outdir] [range]"
    exit 1
fi

SRC="$1"
ROOT_NOTE="$2"
OUTDIR="${3:-.}"
RANGE="${4:-24}"

mkdir -p "$OUTDIR"

LOW_NOTE=$((ROOT_NOTE - RANGE))
HIGH_NOTE=$((ROOT_NOTE + RANGE))

for NOTE in $(seq $LOW_NOTE $HIGH_NOTE); do
    SEMI=$((NOTE - ROOT_NOTE))
    OUT="$OUTDIR/note_$NOTE.wav"
    rubberband -t 1.0 -p "$SEMI" "$SRC" "$OUT" -q
done
