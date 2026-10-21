# Docker Marian Setup

Build the CPU-only Marian image from the workspace root:

```bash
./docker-marian.sh build
```

Verify the installation:

```bash
./docker-marian.sh version
```

Open a shell with the repository mounted at `/workspace`:

```bash
./docker-marian.sh shell
```

The notebook should use `/workspace/myhi_data` inside the container. Model, vocabulary, and result directories written under the workspace remain available on macOS.

## Training

After generating `myhi_data/vocab/vocab.raw.yml`, run the required directions with:

```bash
./train_marian.sh s2s my-hi
./train_marian.sh s2s hi-my
./train_marian.sh transformer my-hi
./train_marian.sh transformer hi-my
```

The first run is intentionally conservative for CPU execution. Model checkpoints are written under `models/`.
