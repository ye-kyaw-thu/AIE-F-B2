#!/bin/bash
# ============================================================
#  SVM POS Tagger — LIBLINEAR pipeline
#  Usage: bash 03_run_liblinear.sh /path/to/liblinear
# ============================================================

set -e

DATA_DIR=${DATA_DIR:-./data}       # folder with train.txt / test.txt
WORK_DIR=${WORK_DIR:-./work}
LIBLINEAR_HOME=${1:-./liblinear}   # path to liblinear source dir

TRAIN_BIN="$LIBLINEAR_HOME/train"
PRED_BIN="$LIBLINEAR_HOME/predict"

mkdir -p "$WORK_DIR"

# ---- Step 1: Preprocess myPOS → CoNLL ----
echo "=== [1/5] Preprocessing ==="
python3 01_preprocess.py "$DATA_DIR/train.txt" "$WORK_DIR/train.conll"
python3 01_preprocess.py "$DATA_DIR/test.txt"  "$WORK_DIR/test.conll"

# ---- Step 2: Featurize → libsvm format ----
echo "=== [2/5] Feature extraction ==="
python3 02_featurize.py train "$WORK_DIR/train.conll" \
                          "$WORK_DIR/train.svm"  "$WORK_DIR/vocab.pkl"
python3 02_featurize.py test  "$WORK_DIR/test.conll"  \
                          "$WORK_DIR/test.svm"   "$WORK_DIR/vocab.pkl"

# ---- Step 3: Train LIBLINEAR ----
#   -s 2  : L2-regularized L2-loss SVM (dual)
#   -c 1.0: regularization cost
echo "=== [3/5] Training LIBLINEAR ==="
"$TRAIN_BIN" -s 2 -c 1.0 -e 0.001 "$WORK_DIR/train.svm" "$WORK_DIR/model.bin"

# ---- Step 4: Predict ----
echo "=== [4/5] Predicting ==="
"$PRED_BIN" "$WORK_DIR/test.svm" "$WORK_DIR/model.bin" \
            "$WORK_DIR/test.pred" 2>&1 | tee "$WORK_DIR/predict.log"

# ---- Step 5: Evaluate ----
echo "=== [5/5] Evaluation ==="
python3 04_evaluate.py "$WORK_DIR/test.conll" \
                       "$WORK_DIR/test.pred"   \
                       "$WORK_DIR/vocab.pkl"

echo "=== Done ==="

