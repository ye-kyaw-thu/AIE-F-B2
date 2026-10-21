#!/usr/bin/env bash
# Runs the experiments in parallel. Usage: ./run_all.sh base|tune
set -euo pipefail
cd "$(dirname "$0")"

case "${1:-base}" in
  base)
    for dir in my-hi hi-my; do
      for hi in word char; do
        python3 nmt.py train s2s "$dir" --hi "$hi" &
        python3 nmt.py train tf "$dir" --hi "$hi" &
      done
    done
    ;;
  tune)
    for dir in my-hi hi-my; do
      python3 nmt.py train tf-small "$dir" --dim-emb 128 --transformer-dim-ffn 256 --enc-depth 1 --dec-depth 1 --transformer-heads 2 &
      python3 nmt.py train tf-drop "$dir" --transformer-dropout 0.3 &
      python3 nmt.py train tf-deep "$dir" --enc-depth 3 --dec-depth 3 --transformer-dropout 0.3 &
    done
    ;;
esac
wait
