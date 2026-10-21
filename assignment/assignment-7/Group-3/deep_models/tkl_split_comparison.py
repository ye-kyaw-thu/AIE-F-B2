"""Compare Thein Kyaw Lwin's multi-task runs with the group's TF-IDF baseline on his split.

His runs (../assignment-7-thein-kyaw-lwin/) use their own data cleaning and one shared
train / val / test split, so their scores cannot sit in the main results table. Here the
group's baseline (same features, models and C grid as baseline_traditional_ml.ipynb, C chosen
on validation) is trained and scored on his split, and his runs are rescored from their saved
test predictions, so all rows below share one test set.

Output: results/tkl_split_comparison.csv
"""
import json
from pathlib import Path

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score
from sklearn.multiclass import OneVsRestClassifier
from sklearn.pipeline import FeatureUnion
from sklearn.svm import LinearSVC

SEED = 42
HERE = Path(__file__).resolve().parent
TKL = HERE.parent / "assignment-7-thein-kyaw-lwin"
TASKS = {
    "task1": ["polarization"],
    "task2": ["political", "racial/ethnic", "religious", "gender/sexual", "other"],
    "task3": ["stereotype", "vilification", "dehumanization", "extreme_language", "lack_of_empathy", "invalidation"],
}
RUNS = {  # output folder -> model description
    "v1_unweighted": "XLM-RoBERTa base, multi-task, no class weights",
    "v2_pos_weight": "XLM-RoBERTa base, multi-task",
    "v3_mbert_pos_weight": "mBERT (cased), multi-task",
    "v4_bilstm_pos_weight": "Bi-LSTM + attention, words, multi-task",
    "v5_bilstm_syllable_pos_weight": "Bi-LSTM + attention, syllables, multi-task",
}

# --- group baseline, same configuration as baseline_traditional_ml.ipynb ---
FEATURES = ["word", "char", "word+char"]
MODELS = ["LogReg", "LinearSVC"]
C_GRID = [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30, 100]


def make_features(kind):
    word = TfidfVectorizer(token_pattern=r"\S+", ngram_range=(1, 2), min_df=2, sublinear_tf=True)
    char = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=2, sublinear_tf=True, max_features=200_000)
    return {"word": word, "char": char, "word+char": FeatureUnion([("word", word), ("char", char)])}[kind]


def make_model(name, C, multilabel):
    if name == "LogReg":
        m = LogisticRegression(C=C, class_weight="balanced", max_iter=2000, solver="liblinear", random_state=SEED)
    else:
        m = LinearSVC(C=C, class_weight="balanced", max_iter=5000, random_state=SEED)
    return OneVsRestClassifier(m) if multilabel else m


def macro_f1(y_true, y_pred):
    return f1_score(y_true, y_pred, average="macro", zero_division=0)


def baseline(splits, labels):
    multilabel = len(labels) > 1
    y = {s: splits[s][labels].values if multilabel else splits[s][labels[0]].values for s in splits}
    best = {"val": -1}
    for feat in FEATURES:
        vec = make_features(feat)
        X = {"train": vec.fit_transform(splits["train"]["text"])}
        X["val"], X["test"] = vec.transform(splits["val"]["text"]), vec.transform(splits["test"]["text"])
        for name in MODELS:
            for C in C_GRID:
                m = make_model(name, C, multilabel).fit(X["train"], y["train"])
                val = macro_f1(y["val"], m.predict(X["val"]))
                if val > best["val"]:
                    best = {"val": val, "name": f"TF-IDF + {name} ({feat}, C={C})", "pred": m.predict(X["test"])}
    return best["name"], best["val"], y["test"], best["pred"]


def per_label(y_true, y_pred, labels):
    if len(labels) == 1:
        return {}
    return {l: round(f1_score(y_true[:, i], y_pred[:, i], zero_division=0), 4) for i, l in enumerate(labels)}


def main():
    splits = {s: pd.read_csv(TKL / "data" / f"{s}.csv") for s in ["train", "val", "test"]}
    for s in splits:
        splits[s]["text"] = splits[s]["text"].fillna("")
    rows = []

    for task, labels in TASKS.items():
        name, val, y_true, y_pred = baseline(splits, labels)
        rows.append({"task": task, "run": "group_baseline", "model": name, "val_macro_f1": round(val, 4),
                     "test_macro_f1": round(macro_f1(y_true, y_pred), 4),
                     "per_label_test_f1": json.dumps(per_label(y_true, y_pred, labels), ensure_ascii=False)})
        print(f"{task} baseline: {rows[-1]['model']} -> {rows[-1]['test_macro_f1']}")

    for run, desc in RUNS.items():
        out = TKL / "kaggle" / "output" / run
        preds = pd.read_csv(next(out.glob("test_predictions*.csv")))
        reported = json.loads(next(out.glob("test_evaluation_summary*.json")).read_text())
        for task, labels in TASKS.items():
            y_true = preds[[f"gold_{l}" for l in labels]].values
            y_pred = preds[[f"pred_{l}" for l in labels]].values
            if len(labels) == 1:
                y_true, y_pred = y_true[:, 0], y_pred[:, 0]
            score = macro_f1(y_true, y_pred)
            assert abs(score - reported[f"{task}_macro_f1"]) < 1e-3, (run, task, score)
            rows.append({"task": task, "run": run, "model": desc, "val_macro_f1": None,
                         "test_macro_f1": round(score, 4),
                         "per_label_test_f1": json.dumps(per_label(y_true, y_pred, labels), ensure_ascii=False)})

    res = pd.DataFrame(rows)
    res.to_csv(HERE / "results" / "tkl_split_comparison.csv", index=False)
    print(res.pivot(index="run", columns="task", values="test_macro_f1").to_string())


if __name__ == "__main__":
    main()
