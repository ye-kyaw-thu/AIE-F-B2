"""
train_bilstm.py
===============
Kaggle Kernel: Multi-Task Bi-LSTM with Self-Attention for Myanmar Online Polarization Detection
Architecture:  Bidirectional LSTM + Word Attention + Masked Max-Pooling (Multi-Task Heads)
Benchmark:     SemEval-2026 Task 9 (POLAR)

Tasks Trained Jointly:
  - Task 1: Polarization Detection (Binary: 0 vs 1)
  - Task 2: Polarization Target Type (Multi-Label: 5 classes)
            [political, racial/ethnic, religious, gender/sexual, other]
  - Task 3: Polarization Manifestation (Multi-Label: 6 classes)
            [stereotype, vilification, dehumanization, extreme_language, lack_of_empathy, invalidation]

Dataset source (kernel-metadata.json):
  - theinkyawlwin/mypolar-assignment7 (train.csv, val.csv, test.csv)

Hardware: GPU (Tesla T4) / CPU compatible
Author:   Thein Kyaw Lwin (AIEF2 Assignment-7)
"""

import os
import sys
import time
import json
import random
from pathlib import Path
from collections import Counter

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.metrics import (
    f1_score,
    accuracy_score,
    precision_score,
    recall_score,
)


# ---------------------------------------------------------------------------
# Helpers & Utilities
# ---------------------------------------------------------------------------

def section(title: str):
    """Print visually distinct section header."""
    print(f"\n{'#' * 75}")
    print(f"# {title}")
    print(f"{'#' * 75}\n")


def resolve_path(candidates: list, label: str) -> str:
    """Return the first existing path from candidates, or raise clear error."""
    for c in candidates:
        if os.path.exists(c):
            print(f"[Path Resolved] {label:<15} -> {c}")
            return c
    raise FileNotFoundError(
        f"Could not locate {label}. Searched candidates:\n"
        + "\n".join(f"  - {c}" for c in candidates)
    )


def seed_everything(seed: int = 42):
    """Ensure strict experimental reproducibility."""
    random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


# ---------------------------------------------------------------------------
# Configuration & Constants
# ---------------------------------------------------------------------------

SEED = 42
MAX_SEQ_LEN = 128
EMBED_DIM = 256
HIDDEN_DIM = 128
NUM_LAYERS = 2
DROPOUT = 0.3
BATCH_SIZE = 32
LEARNING_RATE = 1e-3
WEIGHT_DECAY = 1e-4
EPOCHS = 15
PATIENCE = 5

TASK1_LABELS = ["polarization"]
TASK2_LABELS = ["political", "racial/ethnic", "religious", "gender/sexual", "other"]
TASK3_LABELS = [
    "stereotype",
    "vilification",
    "dehumanization",
    "extreme_language",
    "lack_of_empathy",
    "invalidation",
]

# Task Weights in Combined Multi-Task Loss
TASK1_WEIGHT = 1.0
TASK2_WEIGHT = 1.0
TASK3_WEIGHT = 1.0

WORKING_DIR = "/kaggle/working" if os.path.exists("/kaggle/working") else "./output"
os.makedirs(WORKING_DIR, exist_ok=True)
CHECKPOINT_PATH = os.path.join(WORKING_DIR, "best_bilstm_multitask.pt")


# ---------------------------------------------------------------------------
# Dataset & Vocabulary
# ---------------------------------------------------------------------------

class Vocabulary:
    """Word-level Vocabulary builder with special tokens."""
    PAD_TOKEN = "<pad>"
    UNK_TOKEN = "<unk>"
    PAD_IDX = 0
    UNK_IDX = 1

    def __init__(self, min_freq: int = 1):
        self.min_freq = min_freq
        self.word2idx = {self.PAD_TOKEN: self.PAD_IDX, self.UNK_TOKEN: self.UNK_IDX}
        self.idx2word = {self.PAD_IDX: self.PAD_TOKEN, self.UNK_IDX: self.UNK_TOKEN}

    def build_vocab(self, texts):
        counter = Counter()
        for t in texts:
            words = str(t).split()
            counter.update(words)

        idx = 2
        for word, count in counter.items():
            if count >= self.min_freq:
                if word not in self.word2idx:
                    self.word2idx[word] = idx
                    self.idx2word[idx] = word
                    idx += 1
        print(f"Built Vocabulary: {len(self.word2idx):,} total tokens (min_freq={self.min_freq})")

    def __len__(self):
        return len(self.word2idx)

    def get(self, word: str) -> int:
        return self.word2idx.get(word, self.UNK_IDX)

    def save(self, path: str):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.word2idx, f, ensure_ascii=False, indent=2)


class MyanmarBiLSTMDataset(Dataset):
    """PyTorch Dataset for Word-Tokenized Myanmar Polarization Data."""

    def __init__(self, df: pd.DataFrame, vocab: Vocabulary, max_len: int = 128):
        self.df = df.reset_index(drop=True)
        self.vocab = vocab
        self.max_len = max_len

        self.t1_targets = self.df[TASK1_LABELS].values.astype(np.float32)
        self.t2_targets = self.df[TASK2_LABELS].values.astype(np.float32)
        self.t3_targets = self.df[TASK3_LABELS].values.astype(np.float32)

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        text = str(self.df.iloc[idx]["text"])
        words = text.split()
        token_ids = [self.vocab.get(w) for w in words][: self.max_len]
        seq_len = len(token_ids)

        if len(token_ids) < self.max_len:
            token_ids = token_ids + [Vocabulary.PAD_IDX] * (self.max_len - len(token_ids))

        return {
            "input_ids": torch.tensor(token_ids, dtype=torch.long),
            "seq_len": torch.tensor(seq_len, dtype=torch.long),
            "t1_target": torch.tensor(self.t1_targets[idx], dtype=torch.float32),
            "t2_target": torch.tensor(self.t2_targets[idx], dtype=torch.float32),
            "t3_target": torch.tensor(self.t3_targets[idx], dtype=torch.float32),
        }


# ---------------------------------------------------------------------------
# Model Architecture: MultiTaskBiLSTMAttention
# ---------------------------------------------------------------------------

class MultiTaskBiLSTMAttention(nn.Module):
    """
    Bi-LSTM with Self-Attention and Masked Max Pooling for Multi-Task Myanmar Polarization.
    Shared representation captures sentence context; separate heads predict Task 1, 2, 3.
    """

    def __init__(
        self,
        vocab_size: int,
        embed_dim: int = 256,
        hidden_dim: int = 128,
        num_layers: int = 2,
        dropout: float = 0.3,
        pad_idx: int = 0,
    ):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=pad_idx)
        self.embed_dropout = nn.Dropout(dropout)

        self.lstm = nn.LSTM(
            input_size=embed_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            bidirectional=True,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )

        lstm_out_dim = hidden_dim * 2  # Bidirectional

        # Self-Attention projection
        self.att_dense = nn.Linear(lstm_out_dim, hidden_dim)
        self.att_context = nn.Linear(hidden_dim, 1, bias=False)

        # Combined representations: Attention context (256) + Max pool (256) = 512
        combined_dim = lstm_out_dim * 2
        self.fc_shared = nn.Sequential(
            nn.Linear(combined_dim, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(),
            nn.Dropout(dropout),
        )

        # Multi-task Classification Heads
        self.head_t1 = nn.Linear(256, 1)                  # Task 1: Binary (logit)
        self.head_t2 = nn.Linear(256, len(TASK2_LABELS))  # Task 2: Multi-Label (5 logits)
        self.head_t3 = nn.Linear(256, len(TASK3_LABELS))  # Task 3: Multi-Label (6 logits)

    def forward(self, input_ids):
        # input_ids: [Batch, SeqLen]
        mask = (input_ids != Vocabulary.PAD_IDX)  # [Batch, SeqLen]

        # 1. Embedding
        x = self.embed_dropout(self.embedding(input_ids))  # [Batch, SeqLen, EmbedDim]

        # 2. Bi-LSTM
        lstm_out, _ = self.lstm(x)  # [Batch, SeqLen, HiddenDim*2]

        # 3. Attention Mechanism
        u = torch.tanh(self.att_dense(lstm_out))           # [Batch, SeqLen, HiddenDim]
        scores = self.att_context(u).squeeze(-1)           # [Batch, SeqLen]
        scores = scores.masked_fill(~mask, -1e9)
        weights = torch.softmax(scores, dim=-1).unsqueeze(-1)  # [Batch, SeqLen, 1]
        att_rep = torch.sum(lstm_out * weights, dim=1)      # [Batch, HiddenDim*2]

        # 4. Masked Global Max Pooling
        masked_lstm = lstm_out.masked_fill(~mask.unsqueeze(-1), -1e9)
        max_rep, _ = torch.max(masked_lstm, dim=1)         # [Batch, HiddenDim*2]

        # 5. Concatenate & Shared Feature
        combined = torch.cat([att_rep, max_rep], dim=-1)   # [Batch, HiddenDim*4]
        shared_feat = self.fc_shared(combined)             # [Batch, 256]

        # 6. Task Heads
        logits_t1 = self.head_t1(shared_feat)
        logits_t2 = self.head_t2(shared_feat)
        logits_t3 = self.head_t3(shared_feat)

        return logits_t1, logits_t2, logits_t3


# ---------------------------------------------------------------------------
# Pos Weights Calculator
# ---------------------------------------------------------------------------

def compute_pos_weights(df: pd.DataFrame, label_cols: list) -> torch.Tensor:
    """Calculate dynamic class imbalance weight (num_neg / num_pos) per column."""
    weights = []
    total = len(df)
    for col in label_cols:
        num_pos = float(df[col].sum())
        num_neg = float(total - num_pos)
        w = num_neg / max(num_pos, 1.0)
        weights.append(w)
    return torch.tensor(weights, dtype=torch.float32)


# ---------------------------------------------------------------------------
# Evaluation Routine
# ---------------------------------------------------------------------------

def evaluate(model, loader, device, criterion_t1, criterion_t2, criterion_t3):
    model.eval()
    total_loss = 0.0

    all_t1_preds, all_t1_targets, all_t1_probs = [], [], []
    all_t2_preds, all_t2_targets, all_t2_probs = [], [], []
    all_t3_preds, all_t3_targets, all_t3_probs = [], [], []

    with torch.no_grad():
        for batch in loader:
            input_ids = batch["input_ids"].to(device)
            t1_target = batch["t1_target"].to(device)
            t2_target = batch["t2_target"].to(device)
            t3_target = batch["t3_target"].to(device)

            logits_t1, logits_t2, logits_t3 = model(input_ids)

            loss1 = criterion_t1(logits_t1, t1_target)
            loss2 = criterion_t2(logits_t2, t2_target)
            loss3 = criterion_t3(logits_t3, t3_target)
            loss = (TASK1_WEIGHT * loss1) + (TASK2_WEIGHT * loss2) + (TASK3_WEIGHT * loss3)
            total_loss += loss.item()

            p1 = torch.sigmoid(logits_t1).cpu().numpy()
            p2 = torch.sigmoid(logits_t2).cpu().numpy()
            p3 = torch.sigmoid(logits_t3).cpu().numpy()

            all_t1_probs.append(p1)
            all_t2_probs.append(p2)
            all_t3_probs.append(p3)

            all_t1_preds.append((p1 >= 0.5).astype(int))
            all_t2_preds.append((p2 >= 0.5).astype(int))
            all_t3_preds.append((p3 >= 0.5).astype(int))

            all_t1_targets.append(t1_target.cpu().numpy())
            all_t2_targets.append(t2_target.cpu().numpy())
            all_t3_targets.append(t3_target.cpu().numpy())

    all_t1_preds = np.vstack(all_t1_preds)
    all_t1_targets = np.vstack(all_t1_targets)
    all_t1_probs = np.vstack(all_t1_probs)

    all_t2_preds = np.vstack(all_t2_preds)
    all_t2_targets = np.vstack(all_t2_targets)
    all_t2_probs = np.vstack(all_t2_probs)

    all_t3_preds = np.vstack(all_t3_preds)
    all_t3_targets = np.vstack(all_t3_targets)
    all_t3_probs = np.vstack(all_t3_probs)

    # Metrics computation
    t1_macro_f1 = f1_score(all_t1_targets, all_t1_preds, average="macro", zero_division=0)
    t1_acc = accuracy_score(all_t1_targets, all_t1_preds)

    t2_macro_f1 = f1_score(all_t2_targets, all_t2_preds, average="macro", zero_division=0)
    t2_micro_f1 = f1_score(all_t2_targets, all_t2_preds, average="micro", zero_division=0)

    t3_macro_f1 = f1_score(all_t3_targets, all_t3_preds, average="macro", zero_division=0)
    t3_micro_f1 = f1_score(all_t3_targets, all_t3_preds, average="micro", zero_division=0)

    overall_macro_f1 = (t1_macro_f1 + t2_macro_f1 + t3_macro_f1) / 3.0

    return {
        "loss": total_loss / len(loader),
        "overall_macro_f1": overall_macro_f1,
        "t1_macro_f1": t1_macro_f1,
        "t1_accuracy": t1_acc,
        "t2_macro_f1": t2_macro_f1,
        "t2_micro_f1": t2_micro_f1,
        "t3_macro_f1": t3_macro_f1,
        "t3_micro_f1": t3_micro_f1,
        "t1_preds": all_t1_preds,
        "t1_targets": all_t1_targets,
        "t1_probs": all_t1_probs,
        "t2_preds": all_t2_preds,
        "t2_targets": all_t2_targets,
        "t2_probs": all_t2_probs,
        "t3_preds": all_t3_preds,
        "t3_targets": all_t3_targets,
        "t3_probs": all_t3_probs,
    }


# ---------------------------------------------------------------------------
# Main Training Pipeline
# ---------------------------------------------------------------------------

def main():
    start_time = time.time()
    seed_everything(SEED)

    section("Step 1: Environment & Hardware Configuration")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device               : {device}")
    if device.type == "cuda":
        print(f"GPU Name             : {torch.cuda.get_device_name(0)}")
        print(f"GPU Memory (Total)   : {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")

    section("Step 2: Dataset Loading & Validation")
    data_dir = resolve_path([
        "/kaggle/input/mypolar-assignment7",
        "/kaggle/input/datasets/theinkyawlwin/mypolar-assignment7",
        "./data",
        "../data",
        os.path.join(os.path.dirname(__file__), "../../data") if "__file__" in locals() else "./data",
    ], "Data Directory")

    train_path = os.path.join(data_dir, "train.csv")
    val_path = os.path.join(data_dir, "val.csv")
    test_path = os.path.join(data_dir, "test.csv")

    train_df = pd.read_csv(train_path)
    val_df = pd.read_csv(val_path)
    test_df = pd.read_csv(test_path)

    print(f"Train samples        : {len(train_df):,}")
    print(f"Val samples          : {len(val_df):,}")
    print(f"Test samples         : {len(test_df):,}")

    section("Step 3: Building Vocabulary & DataLoaders")
    vocab = Vocabulary(min_freq=1)
    vocab.build_vocab(train_df["text"])
    vocab_path = os.path.join(WORKING_DIR, "vocab.json")
    vocab.save(vocab_path)
    print(f"[Saved] Vocabulary mapping to: {vocab_path}")

    train_dataset = MyanmarBiLSTMDataset(train_df, vocab, max_len=MAX_SEQ_LEN)
    val_dataset = MyanmarBiLSTMDataset(val_df, vocab, max_len=MAX_SEQ_LEN)
    test_dataset = MyanmarBiLSTMDataset(test_df, vocab, max_len=MAX_SEQ_LEN)

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, drop_last=False)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False)

    section("Step 4: Model Initialization")
    model = MultiTaskBiLSTMAttention(
        vocab_size=len(vocab),
        embed_dim=EMBED_DIM,
        hidden_dim=HIDDEN_DIM,
        num_layers=NUM_LAYERS,
        dropout=DROPOUT,
        pad_idx=Vocabulary.PAD_IDX,
    ).to(device)

    total_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Model Architecture   : MultiTaskBiLSTMAttention")
    print(f"Embedding Dim        : {EMBED_DIM}")
    print(f"Bi-LSTM Hidden Dim   : {HIDDEN_DIM} (Bidirectional = {HIDDEN_DIM * 2})")
    print(f"Bi-LSTM Num Layers   : {NUM_LAYERS}")
    print(f"Attention Pooling    : Active (Self-Attention + Masked Max Pool)")
    print(f"Total Trainable Params: {total_params:,}")

    # Compute Pos Weights for BCE
    pw_t1 = compute_pos_weights(train_df, TASK1_LABELS).to(device)
    pw_t2 = compute_pos_weights(train_df, TASK2_LABELS).to(device)
    pw_t3 = compute_pos_weights(train_df, TASK3_LABELS).to(device)

    print(f"Task 1 pos_weight    : {pw_t1.cpu().numpy().round(2).tolist()}")
    print(f"Task 2 pos_weights   : {dict(zip(TASK2_LABELS, pw_t2.cpu().numpy().round(2).tolist()))}")
    print(f"Task 3 pos_weights   : {dict(zip(TASK3_LABELS, pw_t3.cpu().numpy().round(2).tolist()))}")

    criterion_t1 = nn.BCEWithLogitsLoss(pos_weight=pw_t1)
    criterion_t2 = nn.BCEWithLogitsLoss(pos_weight=pw_t2)
    criterion_t3 = nn.BCEWithLogitsLoss(pos_weight=pw_t3)

    optimizer = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="max", factor=0.5, patience=2
    )

    section("Step 5: Training Loop (Multi-Task Learning with Early Stopping)")
    best_overall_f1 = 0.0
    history = []
    patience_counter = 0

    for epoch in range(1, EPOCHS + 1):
        epoch_start = time.time()
        model.train()
        train_loss = 0.0

        for step, batch in enumerate(train_loader, start=1):
            optimizer.zero_grad()

            input_ids = batch["input_ids"].to(device)
            t1_target = batch["t1_target"].to(device)
            t2_target = batch["t2_target"].to(device)
            t3_target = batch["t3_target"].to(device)

            logits_t1, logits_t2, logits_t3 = model(input_ids)

            loss1 = criterion_t1(logits_t1, t1_target)
            loss2 = criterion_t2(logits_t2, t2_target)
            loss3 = criterion_t3(logits_t3, t3_target)
            total_step_loss = (TASK1_WEIGHT * loss1) + (TASK2_WEIGHT * loss2) + (TASK3_WEIGHT * loss3)

            total_step_loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

            train_loss += total_step_loss.item()

            if step % 50 == 0 or step == len(train_loader):
                print(f"Epoch [{epoch}/{EPOCHS}] | Step [{step}/{len(train_loader)}] | Step Loss: {total_step_loss.item():.4f}")

        avg_train_loss = train_loss / len(train_loader)
        val_metrics = evaluate(model, val_loader, device, criterion_t1, criterion_t2, criterion_t3)
        scheduler.step(val_metrics["overall_macro_f1"])
        epoch_duration = time.time() - epoch_start

        print(f"\n--- Epoch {epoch} Validation Summary ({epoch_duration:.1f}s) ---")
        print(f"  Train Loss          : {avg_train_loss:.4f}")
        print(f"  Val Loss            : {val_metrics['loss']:.4f}")
        print(f"  Overall Macro F1    : {val_metrics['overall_macro_f1'] * 100:.2f}%")
        print(f"  Task 1 (Pol) F1/Acc : {val_metrics['t1_macro_f1']*100:.2f}% / {val_metrics['t1_accuracy']*100:.2f}%")
        print(f"  Task 2 (Type) F1    : Macro={val_metrics['t2_macro_f1']*100:.2f}% | Micro={val_metrics['t2_micro_f1']*100:.2f}%")
        print(f"  Task 3 (Manif) F1   : Macro={val_metrics['t3_macro_f1']*100:.2f}% | Micro={val_metrics['t3_micro_f1']*100:.2f}%")

        history.append({
            "epoch": epoch,
            "train_loss": avg_train_loss,
            "val_loss": val_metrics["loss"],
            "overall_macro_f1": val_metrics["overall_macro_f1"],
            "t1_macro_f1": val_metrics["t1_macro_f1"],
            "t2_macro_f1": val_metrics["t2_macro_f1"],
            "t3_macro_f1": val_metrics["t3_macro_f1"],
        })

        if val_metrics["overall_macro_f1"] > best_overall_f1:
            best_overall_f1 = val_metrics["overall_macro_f1"]
            patience_counter = 0
            print(f"  >>> [SAVING BEST CHECKPOINT] New highest Overall Macro F1: {best_overall_f1 * 100:.2f}%")
            torch.save(model.state_dict(), CHECKPOINT_PATH)
        else:
            patience_counter += 1
            print(f"  Patience: {patience_counter}/{PATIENCE}")
            if patience_counter >= PATIENCE:
                print(f"\n[Early Stopping Triggered] Validation score did not improve for {PATIENCE} epochs.")
                break

    section("Step 6: Blind Test Set Evaluation on Best Checkpoint (Bi-LSTM)")
    print(f"Loading best checkpoint from: {CHECKPOINT_PATH}")
    model.load_state_dict(torch.load(CHECKPOINT_PATH, map_location=device))

    test_metrics = evaluate(model, test_loader, device, criterion_t1, criterion_t2, criterion_t3)

    print("\n" + "=" * 75)
    print("FINAL BENCHMARK TEST SET EVALUATION REPORT (Bi-LSTM)")
    print("=" * 75)
    print(f"Overall Composite Macro F1 : {test_metrics['overall_macro_f1'] * 100:.2f}%")
    print("\n[Task 1: Polarization Detection]")
    print(f"  Macro F1 : {test_metrics['t1_macro_f1'] * 100:.2f}%")
    print(f"  Accuracy : {test_metrics['t1_accuracy'] * 100:.2f}%")

    print("\n[Task 2: Target Type Classification]")
    print(f"  Macro F1 : {test_metrics['t2_macro_f1'] * 100:.2f}%")
    print(f"  Micro F1 : {test_metrics['t2_micro_f1'] * 100:.2f}%")
    for i, col in enumerate(TASK2_LABELS):
        f1_col = f1_score(test_metrics["t2_targets"][:, i], test_metrics["t2_preds"][:, i], zero_division=0)
        print(f"    - {col:<15}: F1 = {f1_col * 100:.2f}%")

    print("\n[Task 3: Manifestation Identification]")
    print(f"  Macro F1 : {test_metrics['t3_macro_f1'] * 100:.2f}%")
    print(f"  Micro F1 : {test_metrics['t3_micro_f1'] * 100:.2f}%")
    for i, col in enumerate(TASK3_LABELS):
        f1_col = f1_score(test_metrics["t3_targets"][:, i], test_metrics["t3_preds"][:, i], zero_division=0)
        print(f"    - {col:<17}: F1 = {f1_col * 100:.2f}%")
    print("=" * 75)

    # Save Output Prediction CSV and Metrics JSON
    section("Step 7: Persisting Artifacts & Export")
    pred_df = test_df[["id", "text"]].copy()

    # Task 1 predictions & probabilities
    pred_df["prob_polarization"] = test_metrics["t1_probs"][:, 0].round(4)
    pred_df["pred_polarization"] = test_metrics["t1_preds"][:, 0]
    pred_df["gold_polarization"] = test_metrics["t1_targets"][:, 0]

    # Task 2 predictions & probabilities
    for i, col in enumerate(TASK2_LABELS):
        pred_df[f"prob_{col}"] = test_metrics["t2_probs"][:, i].round(4)
        pred_df[f"pred_{col}"] = test_metrics["t2_preds"][:, i]
        pred_df[f"gold_{col}"] = test_metrics["t2_targets"][:, i]

    # Task 3 predictions & probabilities
    for i, col in enumerate(TASK3_LABELS):
        pred_df[f"prob_{col}"] = test_metrics["t3_probs"][:, i].round(4)
        pred_df[f"pred_{col}"] = test_metrics["t3_preds"][:, i]
        pred_df[f"gold_{col}"] = test_metrics["t3_targets"][:, i]

    pred_csv_path = os.path.join(WORKING_DIR, "test_predictions_multitask_bilstm.csv")
    pred_df.to_csv(pred_csv_path, index=False, encoding="utf-8")
    print(f"[Saved] Test predictions: {pred_csv_path}")

    metrics_json_path = os.path.join(WORKING_DIR, "test_evaluation_summary_bilstm.json")
    summary = {
        "model": "BiLSTM-Attention-MultiTask",
        "overall_composite_macro_f1": test_metrics["overall_macro_f1"],
        "task1_macro_f1": test_metrics["t1_macro_f1"],
        "task1_accuracy": test_metrics["t1_accuracy"],
        "task2_macro_f1": test_metrics["t2_macro_f1"],
        "task2_micro_f1": test_metrics["t2_micro_f1"],
        "task3_macro_f1": test_metrics["t3_macro_f1"],
        "task3_micro_f1": test_metrics["t3_micro_f1"],
        "training_history": history,
    }
    with open(metrics_json_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"[Saved] Evaluation summary JSON: {metrics_json_path}")

    elapsed_total = time.time() - start_time
    print(f"\n[DONE] Full Bi-LSTM pipeline executed successfully in {elapsed_total / 60:.2f} minutes.")


if __name__ == "__main__":
    main()

