#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE_NAME="${MARIAN_IMAGE:-assignment6-marian:cpu}"
MODEL_TYPE="${1:-transformer}"
DIRECTION="${2:-my-hi}"
MODEL_DIR="$ROOT_DIR/models/${MODEL_TYPE}.${DIRECTION}"
VOCAB="$ROOT_DIR/myhi_data/vocab/vocab.raw.yml"

mkdir -p "$MODEL_DIR"

case "$DIRECTION" in
  my-hi)
    TRAIN_SRC="train.my"
    TRAIN_TRG="train.hi"
    VALID_SRC="valid.my"
    VALID_TRG="valid.hi"
    ;;
  hi-my)
    TRAIN_SRC="train.hi"
    TRAIN_TRG="train.my"
    VALID_SRC="valid.hi"
    VALID_TRG="valid.my"
    ;;
  *)
    echo "Direction must be my-hi or hi-my" >&2
    exit 2
    ;;
esac

case "$MODEL_TYPE" in
  s2s)
    ARCH_ARGS=(--type s2s --dim-rnn 256 --enc-depth 1 --dec-depth 1)
    ;;
  transformer)
    ARCH_ARGS=(--type transformer --dim-emb 128 --transformer-dim-ffn 256 --transformer-depth 1 --transformer-heads 2)
    ;;
  *)
    echo "Model type must be s2s or transformer" >&2
    exit 2
    ;;
esac

docker run --rm --platform linux/amd64 \
  -v "$ROOT_DIR:/workspace" \
  -w /workspace \
  --entrypoint /opt/marian-dev/build/marian \
  "$IMAGE_NAME" \
  --model "/workspace/models/${MODEL_TYPE}.${DIRECTION}/model.npz" \
  "${ARCH_ARGS[@]}" \
  --train-sets "/workspace/myhi_data/${TRAIN_SRC}" "/workspace/myhi_data/${TRAIN_TRG}" \
  --vocabs "/workspace/myhi_data/vocab/vocab.raw.yml" "/workspace/myhi_data/vocab/vocab.raw.yml" \
  --valid-sets "/workspace/myhi_data/${VALID_SRC}" "/workspace/myhi_data/${VALID_TRG}" \
  --valid-freq 1000u \
  --save-freq 1000u \
  --valid-metrics cross-entropy perplexity bleu \
  --beam-size 4 \
  --mini-batch 16 \
  --workspace 512 \
  --cpu-threads 4 \
  --max-length 80 \
  --early-stopping 5 \
  --after 20e \
  --seed 42
