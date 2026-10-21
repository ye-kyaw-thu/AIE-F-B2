"""
train_xlm_roberta.py
====================
Kaggle Kernel: Multi-Task Learning for Myanmar Online Polarization Detection
Model:         XLM-RoBERTa (xlm-roberta-base)
Benchmark:     SemEval-2026 Task 9 (POLAR)

Tasks Trained Jointly:
  - Task 1: Polarization Detection (Binary: 0 vs 1)
  - Task 2: Polarization Target Type (Multi-Label: 5 classes)
            [political, racial/ethnic, religious, gender/sexual, other]
  - Task 3: Polarization Manifestation (Multi-Label: 6 classes)
            [stereotype, vilification, dehumanization, extreme_language, lack_of_empathy, invalidation]

Dataset source (kernel-metadata.json):
  - theinkyawlwin/mypolar-assignment7 (train.csv, val.csv, test.csv)

Hardware: GPU (Tesla T4 / P100 / GPU with FP16 Mixed Precision)
Author:   Thein Kyaw Lwin (AIEF2 Assignment-7)
"""

import os
import sys
import time
import json
import random
from pathlib import Path

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
    classification_report,
)
from transformers import (
    AutoTokenizer,
    AutoModel,
    AutoConfig,
    get_linear_schedule_with_warmup,
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
    for p in candidates:
        if Path(p).exists():
            print(f"[ok] {label}: {p}")
            return str(Path(p).resolve())
    raise FileNotFoundError(
        f"[ERROR] {label} not found. Tried:\n" +
        "\n".join(f"  {p}" for p in candidates)
    )


def seed_everything(seed: int = 42):
    """Ensure strict reproducibility across runs."""
    random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


# ---------------------------------------------------------------------------
# Configuration & Hyperparameters
# ---------------------------------------------------------------------------

MODEL_NAME = "xlm-roberta-base"
MAX_LENGTH = 160            # Covers >99% of Myanmar sentences in our dataset
BATCH_SIZE = 32             # 32 for Tesla T4 (16GB VRAM)
EPOCHS = 5
LEARNING_RATE = 2e-5
WEIGHT_DECAY = 0.01
WARMUP_RATIO = 0.1
DROPOUT_RATE = 0.2
TASK1_WEIGHT = 1.0          # Loss weighting
TASK2_WEIGHT = 1.0
TASK3_WEIGHT = 1.0

# Paths auto-discovery (Kaggle vs Local layout)
DATA_DIR = resolve_path([
    "/kaggle/input/mypolar-assignment7",
    "/kaggle/input/datasets/theinkyawlwin/mypolar-assignment7",
    os.path.join(os.path.dirname(__file__), "../../data"),
    os.path.join(os.getcwd(), "data"),
], "Data Directory")

WORKING_DIR = "/kaggle/working" if os.path.exists("/kaggle") else os.path.join(os.path.dirname(__file__), "output")
os.makedirs(WORKING_DIR, exist_ok=True)
CHECKPOINT_PATH = os.path.join(WORKING_DIR, "best_xlm_roberta_multitask.pt")

# Labels specification
TASK1_LABEL = ["polarization"]
TASK2_LABELS = ["political", "racial/ethnic", "religious", "gender/sexual", "other"]
TASK3_LABELS = [
    "stereotype", "vilification", "dehumanization",
    "extreme_language", "lack_of_empathy", "invalidation"
]


# ---------------------------------------------------------------------------
# PyTorch Dataset
# ---------------------------------------------------------------------------

class MultiTaskPolarDataset(Dataset):
    """PyTorch Dataset for multi-task polarization training and evaluation."""

    def __init__(self, df: pd.DataFrame, tokenizer, max_len: int = 160):
        self.texts = df["text"].astype(str).tolist()
        self.ids = df["id"].astype(str).tolist()
        self.tokenizer = tokenizer
        self.max_len = max_len

        # Target label matrices
        self.t1_targets = df[TASK1_LABEL].values.astype(np.float32)
        self.t2_targets = df[TASK2_LABELS].values.astype(np.float32)
        self.t3_targets = df[TASK3_LABELS].values.astype(np.float32)

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        text = self.texts[idx]
        encoding = self.tokenizer(
            text,
            truncation=True,
            max_length=self.max_len,
            padding="max_length",
            return_tensors="pt",
        )

        return {
            "id": self.ids[idx],
            "input_ids": encoding["input_ids"].squeeze(0),
            "attention_mask": encoding["attention_mask"].squeeze(0),
            "t1_target": torch.tensor(self.t1_targets[idx], dtype=torch.float),
            "t2_target": torch.tensor(self.t2_targets[idx], dtype=torch.float),
            "t3_target": torch.tensor(self.t3_targets[idx], dtype=torch.float),
        }


# ---------------------------------------------------------------------------
# Multi-Task XLM-RoBERTa Architecture
# ---------------------------------------------------------------------------

class XLMRobertaMultiTaskModel(nn.Module):
    """
    Shared XLM-RoBERTa backbone with three task-specific classification heads:
      1. Head 1: Binary Classification (Task 1: Polarization Detection)
      2. Head 2: Multi-Label Classification (Task 2: 5 Polarization Types)
      3. Head 3: Multi-Label Classification (Task 3: 6 Manifestations)
    """

    def __init__(self, pretrained_model_name: str, dropout_rate: float = 0.2):
        super().__init__()
        self.config = AutoConfig.from_pretrained(pretrained_model_name)
        self.roberta = AutoModel.from_pretrained(pretrained_model_name, config=self.config)
        hidden_size = self.config.hidden_size  # 768 for base

        self.dropout = nn.Dropout(dropout_rate)

        # Task 1 Head (Binary: 1 logit)
        self.head_t1 = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.GELU(),
            nn.Dropout(dropout_rate),
            nn.Linear(hidden_size // 2, 1),
        )

        # Task 2 Head (Multi-Label: 5 logits)
        self.head_t2 = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.GELU(),
            nn.Dropout(dropout_rate),
            nn.Linear(hidden_size // 2, len(TASK2_LABELS)),
        )

        # Task 3 Head (Multi-Label: 6 logits)
        self.head_t3 = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.GELU(),
            nn.Dropout(dropout_rate),
            nn.Linear(hidden_size // 2, len(TASK3_LABELS)),
        )

    def forward(self, input_ids, attention_mask):
        outputs = self.roberta(input_ids=input_ids, attention_mask=attention_mask)
        # Use mean pooling with attention mask for richer sentence representation
        token_embeddings = outputs.last_hidden_state
        input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
        sum_mask = input_mask_expanded.sum(1)
        sum_mask = torch.clamp(sum_mask, min=1e-9)
        pooled_output = sum_embeddings / sum_mask

        pooled_output = self.dropout(pooled_output)

        logits_t1 = self.head_t1(pooled_output)
        logits_t2 = self.head_t2(pooled_output)
        logits_t3 = self.head_t3(pooled_output)

        return logits_t1, logits_t2, logits_t3


# ---------------------------------------------------------------------------
# Evaluation Routine
# ---------------------------------------------------------------------------

def evaluate(model, dataloader, device, criterion_t1=None, criterion_t2=None, criterion_t3=None):
    """Evaluate model and calculate SemEval benchmark metrics."""
    model.eval()

    all_t1_preds, all_t1_targets, all_t1_probs = [], [], []
    all_t2_preds, all_t2_targets, all_t2_probs = [], [], []
    all_t3_preds, all_t3_targets, all_t3_probs = [], [], []
    total_loss = 0.0

    c1 = criterion_t1 if criterion_t1 is not None else nn.BCEWithLogitsLoss()
    c2 = criterion_t2 if criterion_t2 is not None else nn.BCEWithLogitsLoss()
    c3 = criterion_t3 if criterion_t3 is not None else nn.BCEWithLogitsLoss()

    with torch.no_grad():
        for batch in dataloader:
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            t1_target = batch["t1_target"].to(device)
            t2_target = batch["t2_target"].to(device)
            t3_target = batch["t3_target"].to(device)

            logits_t1, logits_t2, logits_t3 = model(input_ids, attention_mask)

            loss1 = c1(logits_t1, t1_target)
            loss2 = c2(logits_t2, t2_target)
            loss3 = c3(logits_t3, t3_target)
            loss = TASK1_WEIGHT * loss1 + TASK2_WEIGHT * loss2 + TASK3_WEIGHT * loss3
            total_loss += loss.item()

            # Probabilities & threshold at 0.5
            probs_t1 = torch.sigmoid(logits_t1).cpu().numpy()
            probs_t2 = torch.sigmoid(logits_t2).cpu().numpy()
            probs_t3 = torch.sigmoid(logits_t3).cpu().numpy()

            all_t1_probs.append(probs_t1)
            all_t1_preds.append((probs_t1 >= 0.5).astype(int))
            all_t1_targets.append(t1_target.cpu().numpy().astype(int))

            all_t2_probs.append(probs_t2)
            all_t2_preds.append((probs_t2 >= 0.5).astype(int))
            all_t2_targets.append(t2_target.cpu().numpy().astype(int))

            all_t3_probs.append(probs_t3)
            all_t3_preds.append((probs_t3 >= 0.5).astype(int))
            all_t3_targets.append(t3_target.cpu().numpy().astype(int))

    t1_probs = np.vstack(all_t1_probs)
    t1_preds = np.vstack(all_t1_preds)
    t1_targets = np.vstack(all_t1_targets)

    t2_probs = np.vstack(all_t2_probs)
    t2_preds = np.vstack(all_t2_preds)
    t2_targets = np.vstack(all_t2_targets)

    t3_probs = np.vstack(all_t3_probs)
    t3_preds = np.vstack(all_t3_preds)
    t3_targets = np.vstack(all_t3_targets)

    # Compute metrics
    # Task 1 (Binary)
    t1_macro_f1 = f1_score(t1_targets[:, 0], t1_preds[:, 0], average="macro", zero_division=0)
    t1_acc = accuracy_score(t1_targets[:, 0], t1_preds[:, 0])

    # Task 2 (Multi-label)
    t2_macro_f1 = f1_score(t2_targets, t2_preds, average="macro", zero_division=0)
    t2_micro_f1 = f1_score(t2_targets, t2_preds, average="micro", zero_division=0)

    # Task 3 (Multi-label)
    t3_macro_f1 = f1_score(t3_targets, t3_preds, average="macro", zero_division=0)
    t3_micro_f1 = f1_score(t3_targets, t3_preds, average="micro", zero_division=0)

    # Combined composite benchmark score
    overall_score = (t1_macro_f1 + t2_macro_f1 + t3_macro_f1) / 3.0

    metrics = {
        "loss": total_loss / len(dataloader),
        "overall_macro_f1": overall_score,
        "t1_macro_f1": t1_macro_f1,
        "t1_accuracy": t1_acc,
        "t2_macro_f1": t2_macro_f1,
        "t2_micro_f1": t2_micro_f1,
        "t3_macro_f1": t3_macro_f1,
        "t3_micro_f1": t3_micro_f1,
        "t1_probs": t1_probs,
        "t1_preds": t1_preds,
        "t1_targets": t1_targets,
        "t2_probs": t2_probs,
        "t2_preds": t2_preds,
        "t2_targets": t2_targets,
        "t3_probs": t3_probs,
        "t3_preds": t3_preds,
        "t3_targets": t3_targets,
    }
    return metrics


# ---------------------------------------------------------------------------
# Main Execution Pipeline
# ---------------------------------------------------------------------------

def main():
    start_time = time.time()
    seed_everything(42)

    section("Step 1: Environment & Hardware Verification")
    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    print(f"[Device] Using compute device: {device}")
    if torch.cuda.is_available():
        print(f"[GPU Name] {torch.cuda.get_device_name(0)}")
        print(f"[VRAM] Total memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")

    section("Step 2: Ingest Stratified Clean Datasets")
    train_csv = os.path.join(DATA_DIR, "train.csv")
    val_csv = os.path.join(DATA_DIR, "val.csv")
    test_csv = os.path.join(DATA_DIR, "test.csv")

    train_df = pd.read_csv(train_csv)
    val_df = pd.read_csv(val_csv)
    test_df = pd.read_csv(test_csv)

    print(f"Train split : {len(train_df):,} samples ({train_csv})")
    print(f"Val split   : {len(val_df):,} samples ({val_csv})")
    print(f"Test split  : {len(test_df):,} samples ({test_csv})")

    section(f"Step 3: Load Pretrained Tokenizer ({MODEL_NAME})")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

    train_dataset = MultiTaskPolarDataset(train_df, tokenizer, max_len=MAX_LENGTH)
    val_dataset = MultiTaskPolarDataset(val_df, tokenizer, max_len=MAX_LENGTH)
    test_dataset = MultiTaskPolarDataset(test_df, tokenizer, max_len=MAX_LENGTH)

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, drop_last=False)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False)

    section(f"Step 4: Initialize Multi-Task Model Architecture")
    model = XLMRobertaMultiTaskModel(MODEL_NAME, dropout_rate=DROPOUT_RATE).to(device)

    # Optimizer & LR Scheduler
    no_decay = ["bias", "LayerNorm.weight"]
    optimizer_grouped_parameters = [
        {
            "params": [p for n, p in model.named_parameters() if not any(nd in n for nd in no_decay)],
            "weight_decay": WEIGHT_DECAY,
        },
        {
            "params": [p for n, p in model.named_parameters() if any(nd in n for nd in no_decay)],
            "weight_decay": 0.0,
        },
    ]

    total_training_steps = len(train_loader) * EPOCHS
    warmup_steps = int(total_training_steps * WARMUP_RATIO)

    optimizer = torch.optim.AdamW(optimizer_grouped_parameters, lr=LEARNING_RATE)
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps=warmup_steps,
        num_training_steps=total_training_steps,
    )
    # Pos-Weight calculation for Class Imbalance
    section("Step 4b: Compute Positive Class Weights (pos_weight)")
    N = len(train_df)

    t1_pos = float(train_df[TASK1_LABEL].values.sum())
    pw_t1 = torch.tensor([(N - t1_pos) / max(t1_pos, 1.0)], dtype=torch.float).to(device)

    t2_pos = train_df[TASK2_LABELS].values.sum(axis=0).astype(float)
    pw_t2 = torch.tensor((N - t2_pos) / np.maximum(t2_pos, 1.0), dtype=torch.float).to(device)

    t3_pos = train_df[TASK3_LABELS].values.sum(axis=0).astype(float)
    pw_t3 = torch.tensor((N - t3_pos) / np.maximum(t3_pos, 1.0), dtype=torch.float).to(device)

    print(f"Task 1 pos_weight : {pw_t1.cpu().numpy().round(2).tolist()}")
    print(f"Task 2 pos_weights: {dict(zip(TASK2_LABELS, pw_t2.cpu().numpy().round(2).tolist()))}")
    print(f"Task 3 pos_weights: {dict(zip(TASK3_LABELS, pw_t3.cpu().numpy().round(2).tolist()))}")

    criterion_t1 = nn.BCEWithLogitsLoss(pos_weight=pw_t1)
    criterion_t2 = nn.BCEWithLogitsLoss(pos_weight=pw_t2)
    criterion_t3 = nn.BCEWithLogitsLoss(pos_weight=pw_t3)
    scaler = torch.cuda.amp.GradScaler(enabled=(device.type == "cuda"))

    section("Step 5: Training Loop (Multi-Task Fine-Tuning with pos_weight)")
    best_overall_f1 = 0.0
    history = []

    for epoch in range(1, EPOCHS + 1):
        epoch_start = time.time()
        model.train()
        train_loss = 0.0

        for step, batch in enumerate(train_loader, start=1):
            optimizer.zero_grad()

            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            t1_target = batch["t1_target"].to(device)
            t2_target = batch["t2_target"].to(device)
            t3_target = batch["t3_target"].to(device)

            with torch.cuda.amp.autocast(enabled=(device.type == "cuda")):
                logits_t1, logits_t2, logits_t3 = model(input_ids, attention_mask)
                loss1 = criterion_t1(logits_t1, t1_target)
                loss2 = criterion_t2(logits_t2, t2_target)
                loss3 = criterion_t3(logits_t3, t3_target)
                total_step_loss = (TASK1_WEIGHT * loss1) + (TASK2_WEIGHT * loss2) + (TASK3_WEIGHT * loss3)

            scaler.scale(total_step_loss).backward()
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            scaler.step(optimizer)
            scaler.update()
            scheduler.step()

            train_loss += total_step_loss.item()

            if step % 50 == 0 or step == len(train_loader):
                print(f"Epoch [{epoch}/{EPOCHS}] | Step [{step}/{len(train_loader)}] | Step Loss: {total_step_loss.item():.4f}")

        avg_train_loss = train_loss / len(train_loader)
        val_metrics = evaluate(model, val_loader, device, criterion_t1, criterion_t2, criterion_t3)
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
            print(f"  >>> [SAVING BEST CHECKPOINT] New highest Overall Macro F1: {best_overall_f1 * 100:.2f}%")
            torch.save(model.state_dict(), CHECKPOINT_PATH)

    section("Step 6: Blind Test Set Evaluation on Best Checkpoint")
    print(f"Loading best checkpoint from: {CHECKPOINT_PATH}")
    model.load_state_dict(torch.load(CHECKPOINT_PATH, map_location=device))

    test_metrics = evaluate(model, test_loader, device, criterion_t1, criterion_t2, criterion_t3)

    print("\n" + "=" * 75)
    print("FINAL BENCHMARK TEST SET EVALUATION REPORT")
    print("=" * 75)
    print(f"Overall Composite Macro F1 : {test_metrics['overall_macro_f1'] * 100:.2f}%\n")

    print(f"[Task 1: Polarization Detection]")
    print(f"  Macro F1 : {test_metrics['t1_macro_f1'] * 100:.2f}%")
    print(f"  Accuracy : {test_metrics['t1_accuracy'] * 100:.2f}%\n")

    print(f"[Task 2: Target Type Classification]")
    print(f"  Macro F1 : {test_metrics['t2_macro_f1'] * 100:.2f}%")
    print(f"  Micro F1 : {test_metrics['t2_micro_f1'] * 100:.2f}%")
    for i, col in enumerate(TASK2_LABELS):
        f1_col = f1_score(test_metrics["t2_targets"][:, i], test_metrics["t2_preds"][:, i], zero_division=0)
        print(f"    - {col:<15}: F1 = {f1_col * 100:.2f}%")

    print(f"\n[Task 3: Manifestation Identification]")
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

    pred_csv_path = os.path.join(WORKING_DIR, "test_predictions_multitask.csv")
    pred_df.to_csv(pred_csv_path, index=False, encoding="utf-8")
    print(f"[Saved] Test predictions: {pred_csv_path}")

    metrics_json_path = os.path.join(WORKING_DIR, "test_evaluation_summary.json")
    summary = {
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
    print(f"\n[DONE] Full pipeline executed successfully in {elapsed_total / 60:.2f} minutes.")


if __name__ == "__main__":
    main()

