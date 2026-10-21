"""
polar_models.py - neural models for the three myPolar tasks.

    python polar_models.py --model bilstm      --task all --seeds 42 43 44
    python polar_models.py --model transformer --task all --seeds 42 43 44
    python polar_models.py --model xlmr        --task all --seeds 42

Models
  bilstm       2-layer Bi-LSTM over syllables, trained from scratch
  transformer  3-layer Transformer encoder over syllables, trained from scratch
  xlmr         XLM-RoBERTa-base, fine-tuned (token embeddings frozen)

Protocol (same as the traditional ML baseline, so the numbers are comparable):
the splits in ../baseline_traditional_ml/splits are reused, the epoch is chosen
on validation macro F1, and the test score reported is the one at that epoch.
Task 1 macro F1 is over the two classes; Task 2/3 macro F1 is over the labels.
Positive classes are up-weighted in the loss (the neural counterpart of
class_weight="balanced"); the decision threshold is fixed at 0.5.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import time
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.metrics import f1_score

HERE = Path(__file__).resolve().parent
TASKS = {
    "task1": ["polarization"],
    "task2": ["political", "racial/ethnic", "religious", "gender/sexual", "other"],
    "task3": ["stereotype", "vilification", "dehumanization", "extreme_language", "lack_of_empathy", "invalidation"],
}
DEVICE = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"

# ---------------------------------------------------------------- text
# Contributors segmented their sentences differently (word-segmented,
# phrase-segmented or not at all), so whitespace is not a reliable token
# boundary. Both tokenisations below ignore the original spacing.
_MY = "က-႟"
_SYL = re.compile(r"(?<!္)([က-အဣ-ဧဩဪဿ၀-၉၊။၌-၏])(?!့?[်္])")


def syllables(text: str) -> list[str]:
    """Myanmar syllables (sylbreak rule); Latin words, numbers and symbols as single tokens."""
    out = []
    for span in re.findall(rf"[{_MY}]+|[A-Za-z]+|\d+|\S", str(text)):
        if re.match(rf"[{_MY}]", span):
            out.extend(_SYL.sub(r" \1", span).split())
        else:
            out.append(span.lower())
    return out


def unsegment(text: str) -> str:
    """Remove spaces between Myanmar characters (the form XLM-R saw in pre-training)."""
    return re.sub(rf"(?<=[{_MY}])\s+(?=[{_MY}])", "", str(text)).strip()


# Input units for the Bi-LSTM / Transformer (--unit). "syllable" is the default used for the
# main results; "word" and "char" exist for the text-unit comparison in error_analysis.py.
UNITS = {
    "syllable": syllables,
    "word": lambda t: str(t).lower().split(),               # the contributor's own whitespace segmentation
    "char": lambda t: list(re.sub(r"\s+", " ", unsegment(t).lower())),
}
LEN_FACTOR = {"syllable": 1, "word": 1, "char": 3}  # a syllable is about 3 characters


def load(task: str, split_dir: Path):
    d = {s: pd.read_csv(split_dir / f"{task}_{s}.csv", encoding="utf-8-sig") for s in ["train", "val", "test"]}
    y = {s: d[s][TASKS[task]].values.astype("float32") for s in d}
    x = {s: d[s]["text"].fillna("").tolist() for s in d}
    return x, y


def macro_f1(y_true, y_pred):
    if y_true.shape[1] == 1:
        y_true, y_pred = y_true.ravel(), y_pred.ravel()
    return f1_score(y_true, y_pred, average="macro", zero_division=0)


# ---------------------------------------------------------------- models
class BiLSTM(nn.Module):
    def __init__(self, vocab, n_out, emb=200, hid=128, drop=0.4):
        super().__init__()
        self.emb = nn.Embedding(vocab, emb, padding_idx=0)
        self.lstm = nn.LSTM(emb, hid, num_layers=2, batch_first=True, bidirectional=True, dropout=drop)
        self.drop = nn.Dropout(drop)
        self.out = nn.Linear(4 * hid, n_out)

    def forward(self, ids, mask):
        h, _ = self.lstm(self.drop(self.emb(ids)))
        m = mask.unsqueeze(-1)
        mean = (h * m).sum(1) / m.sum(1).clamp(min=1)
        mx = h.masked_fill(m == 0, -1e9).max(1).values
        return self.out(self.drop(torch.cat([mean, mx], 1)))


class TransformerClf(nn.Module):
    def __init__(self, vocab, n_out, d=192, heads=4, layers=3, max_len=256, drop=0.2):
        super().__init__()
        self.emb = nn.Embedding(vocab, d, padding_idx=0)
        self.pos = nn.Embedding(max_len, d)
        layer = nn.TransformerEncoderLayer(d, heads, 2 * d, drop, batch_first=True, norm_first=True)
        self.enc = nn.TransformerEncoder(layer, layers, enable_nested_tensor=False)
        self.norm = nn.LayerNorm(d)
        self.drop = nn.Dropout(drop)
        self.out = nn.Linear(d, n_out)

    def forward(self, ids, mask):
        pos = torch.arange(ids.size(1), device=ids.device)
        h = self.drop(self.emb(ids) * math.sqrt(self.emb.embedding_dim) + self.pos(pos))
        h = self.norm(self.enc(h, src_key_padding_mask=mask == 0))
        m = mask.unsqueeze(-1)
        return self.out(self.drop((h * m).sum(1) / m.sum(1).clamp(min=1)))


class XLMR(nn.Module):
    def __init__(self, name, n_out, drop=0.1):
        super().__init__()
        from transformers import AutoModel
        self.enc = AutoModel.from_pretrained(name)
        # The 250k-token embedding matrix is 2/3 of the parameters. It is kept frozen so
        # that the model fits in 16 GB of unified memory (no gradient / Adam state for it).
        self.enc.embeddings.word_embeddings.weight.requires_grad_(False)
        self.drop = nn.Dropout(drop)
        self.out = nn.Linear(self.enc.config.hidden_size, n_out)

    def forward(self, ids, mask):
        h = self.enc(input_ids=ids, attention_mask=mask).last_hidden_state
        m = mask.unsqueeze(-1)
        return self.out(self.drop((h * m).sum(1) / m.sum(1).clamp(min=1)))


CONFIG = {  # lr, batch size, max epochs, early-stopping patience, max tokens
    "bilstm": dict(lr=1e-3, bs=64, epochs=25, patience=5, max_len=200, wd=1e-4),
    "transformer": dict(lr=5e-4, bs=64, epochs=30, patience=6, max_len=200, wd=1e-2),
    "xlmr": dict(lr=2e-5, bs=16, epochs=4, patience=4, max_len=128, wd=1e-2),
}
XLMR_NAME = "FacebookAI/xlm-roberta-base"


# ---------------------------------------------------------------- training
def encode(model_name, x, max_len, unit="syllable"):
    """-> {split: list of token-id lists}, vocab size, pad id."""
    if model_name == "xlmr":
        from transformers import AutoTokenizer
        tok = AutoTokenizer.from_pretrained(XLMR_NAME)
        ids = {s: tok([unsegment(t) for t in x[s]], truncation=True, max_length=max_len)["input_ids"] for s in x}
        return ids, tok.vocab_size, tok.pad_token_id
    toks = {s: [UNITS[unit](t)[:max_len] for t in x[s]] for s in x}
    freq = Counter(t for sent in toks["train"] for t in sent)
    vocab = {t: i + 2 for i, t in enumerate(sorted(t for t, c in freq.items() if c >= 2))}  # 0 pad, 1 unk
    ids = {s: [[vocab.get(t, 1) for t in sent] or [1] for sent in toks[s]] for s in toks}
    return ids, len(vocab) + 2, 0


def batches(ids, y, bs, pad, shuffle, rng=None):
    order = rng.permutation(len(ids)) if shuffle else np.arange(len(ids))
    for i in range(0, len(order), bs):
        idx = order[i:i + bs]
        n = max(len(ids[j]) for j in idx)
        xb = torch.full((len(idx), n), pad, dtype=torch.long)
        mb = torch.zeros((len(idx), n), dtype=torch.float32)
        for r, j in enumerate(idx):
            xb[r, :len(ids[j])] = torch.tensor(ids[j])
            mb[r, :len(ids[j])] = 1
        yield xb.to(DEVICE), mb.to(DEVICE), torch.tensor(y[idx]).to(DEVICE)


@torch.no_grad()
def predict(model, ids, y, bs, pad):
    model.eval()
    out = [torch.sigmoid(model(xb, mb)).cpu().numpy() for xb, mb, _ in batches(ids, y, bs * 2, pad, False)]
    return (np.concatenate(out) >= 0.5).astype(int)


def run(task, model_name, seed, split_dir, unit="syllable", pred_dir=None):
    cfg = dict(CONFIG[model_name])
    if model_name != "xlmr":
        cfg["max_len"] *= LEN_FACTOR[unit]
    torch.manual_seed(seed)
    rng = np.random.default_rng(seed)
    x, y = load(task, split_dir)
    ids, vocab, pad = encode(model_name, x, cfg["max_len"], unit)
    n_out = y["train"].shape[1]

    if model_name == "bilstm":
        model = BiLSTM(vocab, n_out)
    elif model_name == "transformer":
        model = TransformerClf(vocab, n_out, max_len=cfg["max_len"])
    else:
        model = XLMR(XLMR_NAME, n_out)
    model.to(DEVICE)

    pos = y["train"].mean(0)
    loss_fn = nn.BCEWithLogitsLoss(pos_weight=torch.tensor((1 - pos) / pos, dtype=torch.float32).to(DEVICE))
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=cfg["lr"], weight_decay=cfg["wd"])
    steps = cfg["epochs"] * math.ceil(len(ids["train"]) / cfg["bs"])
    warm = int(0.1 * steps)  # linear warm-up then linear decay
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: (s + 1) / warm if s < warm else max(0.0, (steps - s) / (steps - warm)))

    best = {"val": -1.0}
    for epoch in range(1, cfg["epochs"] + 1):
        model.train()
        t, total = time.time(), 0.0
        for xb, mb, yb in batches(ids["train"], y["train"], cfg["bs"], pad, True, rng):
            opt.zero_grad()
            loss = loss_fn(model(xb, mb), yb)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            sched.step()
            total += loss.item() * len(xb)
        val = macro_f1(y["val"], predict(model, ids["val"], y["val"], cfg["bs"], pad))
        print(f"  {task} {model_name} seed={seed} epoch {epoch:2d}  loss {total / len(ids['train']):.4f}  "
              f"val_f1 {val:.4f}  ({time.time() - t:.0f}s)", flush=True)
        if val > best["val"]:
            pred = predict(model, ids["test"], y["test"], cfg["bs"], pad)
            best = {"val": val, "epoch": epoch, "test": macro_f1(y["test"], pred), "pred": pred,
                    "per_label": dict(zip(TASKS[task], f1_score(y["test"], pred, average=None, zero_division=0).round(4).tolist()))
                    if n_out > 1 else {}}
        elif epoch - best["epoch"] >= cfg["patience"]:
            break
    if pred_dir:  # test predictions at the selected epoch, for error analysis
        test = pd.read_csv(split_dir / f"{task}_test.csv", encoding="utf-8-sig")
        out = pd.DataFrame(best["pred"], columns=[f"pred_{c}" for c in TASKS[task]])
        out.insert(0, "id", test["id"])
        Path(pred_dir).mkdir(parents=True, exist_ok=True)
        tag = model_name if unit == "syllable" else f"{model_name}_{unit}"
        out.to_csv(Path(pred_dir) / f"{task}_{tag}_seed{seed}.csv", index=False)
    if unit != "syllable":
        model_name = f"{model_name}_{unit}"
    return {"task": task, "model": model_name, "seed": seed, "best_epoch": best["epoch"],
            "val_macro_f1": round(best["val"], 4), "test_macro_f1": round(best["test"], 4),
            "per_label_test_f1": json.dumps(best["per_label"])}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, choices=list(CONFIG))
    ap.add_argument("--task", default="all", choices=["all", *TASKS])
    ap.add_argument("--seeds", type=int, nargs="+", default=[42])
    ap.add_argument("--splits", default=str(HERE.parent / "baseline_traditional_ml" / "splits"))
    ap.add_argument("--out", default=str(HERE / "results" / "neural_results.csv"))
    ap.add_argument("--unit", default="syllable", choices=list(UNITS), help="input unit (bilstm / transformer only)")
    ap.add_argument("--save_preds", default=None, help="directory for test predictions")
    a = ap.parse_args()

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    print(f"device: {DEVICE}")
    for task in (TASKS if a.task == "all" else [a.task]):
        for seed in a.seeds:
            row = run(task, a.model, seed, Path(a.splits), a.unit, a.save_preds)
            print(f"=> {row}", flush=True)
            pd.DataFrame([row]).to_csv(out, mode="a", header=not out.exists(), index=False)
