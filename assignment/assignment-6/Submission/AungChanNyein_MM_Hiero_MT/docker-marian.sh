#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE_NAME="${MARIAN_IMAGE:-assignment6-marian:cpu}"

case "${1:-shell}" in
  build)
    docker build --platform linux/amd64 -f "$ROOT_DIR/Dockerfile.marian" -t "$IMAGE_NAME" "$ROOT_DIR"
    ;;
  shell)
    docker run --platform linux/amd64 --rm -it \
      -v "$ROOT_DIR:/workspace" \
      -w /workspace \
      "$IMAGE_NAME"
    ;;
  version)
    docker run --platform linux/amd64 --rm \
      -v "$ROOT_DIR:/workspace" \
      -w /workspace \
      --entrypoint /opt/marian-dev/build/marian \
      "$IMAGE_NAME" \
      --version
    ;;
  *)
    echo "Usage: $0 {build|shell|version}" >&2
    exit 2
    ;;
esac
