# Kaggle Experiment Outputs & Benchmarks

This directory contains the experimental runs and evaluation outputs for the **Multi-Task XLM-RoBERTa** model trained on Kaggle GPU for Assignment-7.

---

## Experiment Index

| Experiment Folder | Description | Task 1 Macro F1 | Task 2 Macro F1 | Task 3 Macro F1 | Overall Composite Macro F1 | Key Difference |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| [`v1_unweighted/`](v1_unweighted/) | **Version 1: Baseline Multi-Task (XLM-RoBERTa)** | **77.22%** | **26.12%** | **15.90%** | **39.75%** | Standard `BCEWithLogitsLoss()`. Minority classes collapsed to 0% F1 due to class imbalance and fixed 0.5 threshold. |
| [`v2_pos_weight/`](v2_pos_weight/) | **Version 2: Weighted Multi-Task (XLM-RoBERTa)** | **76.92%** | **55.59%** | **44.93%** | **59.15%** | Added dynamic `pos_weight` penalties. Solved class imbalance; minority classes surged to 33%–52% F1. |
| [`v3_mbert_pos_weight/`](v3_mbert_pos_weight/) | **Version 3: Weighted Multi-Task (mBERT)** | **75.96%** | **56.51%** | **44.80%** | **59.09%** | `bert-base-multilingual-cased` with WordPiece tokenizer. Close overall F1 to XLM-R, but Task 1 and vilification lower due to character fragmentation. |
| [`v4_bilstm_pos_weight/`](v4_bilstm_pos_weight/) | **Version 4: Weighted Multi-Task (Word Bi-LSTM)** | **68.56%** | **48.12%** | **39.15%** | **51.94%** | Custom 2-layer Bi-LSTM with Self-Attention and word-level vocabulary (36,005 words). Fast training but heavily bottlenecked by OOV words and data sparsity. |
| [`v5_bilstm_syllable_pos_weight/`](v5_bilstm_syllable_pos_weight/) | **Version 5: Weighted Multi-Task (Syllable Bi-LSTM)** | **73.36%** | **60.35%** | **46.08%** | **59.93%** | Replaced word-level tokenization with `sylbreak` syllable segmentation (2,884 bounded vocabulary). Eliminates OOV, surges Composite F1 to 59.93% (surpassing XLM-R). |

---

## File Contents in Each Experiment Folder

- `test_evaluation_summary*.json`: Machine-readable metrics summary (Macro F1, Micro F1, per-class F1, Accuracies, training history).
- `test_predictions_multitask*.csv`: Full predictions on the 1,007 test samples (including gold labels, predicted binary flags, and raw probabilities).
- `*.log`: Complete execution stdout/stderr log from the Kaggle Tesla T4 GPU kernel run.
- `vocab*.json` (Bi-LSTM): Word or syllable vocabulary mapping built from the training set.
- Model weights (`*.pt`): Stored in Kaggle cloud output to prevent excessive local repository size (~700MB–1.1GB each).



