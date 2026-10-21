"""
error_analysis.py - text-unit comparison and error analysis on the test sets.

    python error_analysis.py            # writes results/error_analysis/*.csv and prints the tables

Part A  Text unit: which unit should the features be built from? The same linear
        classifier is trained on TF-IDF n-grams of whitespace words, syllables,
        characters inside whitespace tokens, and characters with the spaces removed.
        (The Bi-LSTM counterpart is run with `polar_models.py --unit word|syllable|char`.)
Part B  Task 1 errors of the TF-IDF baseline and the Bi-LSTM, broken down by sentence
        length, segmentation style, contributor, polarization type and manifestation.
Part C  Task 2 / Task 3 errors per label: precision, recall, and which labels are
        predicted in place of the missed one.

C is chosen on validation macro F1, as in the baseline notebook.
"""
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, precision_recall_fscore_support
from sklearn.multiclass import OneVsRestClassifier
from sklearn.pipeline import FeatureUnion
from sklearn.svm import LinearSVC

from contributor_holdout import contributor
from polar_models import TASKS, syllables, unsegment

HERE = Path(__file__).resolve().parent
SPLITS = HERE.parent / "baseline_traditional_ml" / "splits"
FINAL = HERE.parent / "final"
PRED = HERE / "results" / "predictions"
OUT = HERE / "results" / "error_analysis"
SEED = 42
C_GRID = [0.01, 0.03, 0.1, 0.3, 1, 3, 10]


def load(task):
    d = {s: pd.read_csv(SPLITS / f"{task}_{s}.csv", encoding="utf-8-sig") for s in ["train", "val", "test"]}
    for s in d:
        d[s]["text"] = d[s]["text"].fillna("")
    return d


def features(kind):
    word = TfidfVectorizer(token_pattern=r"\S+", ngram_range=(1, 2), min_df=2, sublinear_tf=True)
    char = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=2, sublinear_tf=True, max_features=200_000)
    return {
        "word (whitespace)": word,
        "syllable": TfidfVectorizer(tokenizer=syllables, token_pattern=None, lowercase=False, ngram_range=(1, 3),
                                    min_df=2, sublinear_tf=True),
        "char (within tokens)": char,
        "char (spaces removed)": TfidfVectorizer(preprocessor=unsegment, analyzer="char", ngram_range=(2, 5), min_df=2,
                                                 sublinear_tf=True, max_features=200_000),
        "word+char": FeatureUnion([("word", word), ("char", char)]),
    }[kind]


def fit_best(task, kind):
    """-> validation F1, test F1, C, test predictions, test decision scores, fitted vectoriser and model."""
    labels = TASKS[task]
    multi = len(labels) > 1
    d = load(task)
    y = {s: d[s][labels].values if multi else d[s][labels[0]].values for s in d}
    vec = features(kind)
    X = {"train": vec.fit_transform(d["train"]["text"])}
    X.update({s: vec.transform(d[s]["text"]) for s in ["val", "test"]})
    best = None
    for C in C_GRID:
        if multi:
            m = OneVsRestClassifier(LinearSVC(C=C, class_weight="balanced", max_iter=5000, random_state=SEED))
        else:
            m = LogisticRegression(C=C, class_weight="balanced", max_iter=2000, solver="liblinear", random_state=SEED)
        m.fit(X["train"], y["train"])
        val = f1_score(y["val"], m.predict(X["val"]), average="macro", zero_division=0)
        if best is None or val > best[0]:
            pred = m.predict(X["test"])
            best = (val, f1_score(y["test"], pred, average="macro", zero_division=0), C, pred,
                    m.decision_function(X["test"]), vec, m)
    return best


# ---------------------------------------------------------------- A. text unit
def unit_comparison():
    rows = []
    for kind in ["word (whitespace)", "syllable", "char (within tokens)", "char (spaces removed)"]:
        row = {"features": kind}
        for task in TASKS:
            val, test, C, *_ = fit_best(task, kind)
            row[f"{task}_val"], row[f"{task}_test"] = round(val, 4), round(test, 4)
            print(f"  {kind:22s} {task}  C={C:<5}  val {val:.4f}  test {test:.4f}", flush=True)
        rows.append(row)
    return pd.DataFrame(rows)


# ---------------------------------------------------------------- B. Task 1 errors
def test_metadata():
    """One row per Task 1 test sentence with the properties the errors are broken down by."""
    t = load("task1")["test"]
    fin = pd.read_csv(FINAL / "final_dataset.csv").set_index("id")
    t["contributor"] = contributor(t.id.map(fin.original_id)).values
    t["n_syll"] = t.text.map(lambda s: len(syllables(s)))
    t["length"] = pd.cut(t.n_syll, [0, 15, 30, 60, 10_000], labels=["1-15 syllables", "16-30", "31-60", "61+"])
    per_tok = t.text.map(lambda s: len(unsegment(s)) / max(1, len(s.split())))  # characters per whitespace token
    t["segmentation"] = pd.cut(per_tok, [0, 7, 15, 10_000], labels=["word-segmented (<7 chars/token)",
                                                                   "phrase-segmented (7-15)", "unsegmented (15+)"])
    t2 = pd.read_csv(FINAL / "task2_type.csv").set_index("id")
    t3 = pd.read_csv(FINAL / "task3_manifestation.csv").set_index("id")
    for c in TASKS["task2"]:
        t[c] = t.id.map(t2[c])
    for c in TASKS["task3"]:
        t[c] = t.id.map(t3[c])
    return t


def breakdown(t, by, models):
    """Accuracy, false-positive rate and false-negative rate of each model within the groups of `by`."""
    rows = []
    for key, g in t.groupby(by, observed=True):
        row = {by: key, "n": len(g), "polarized_share": round(g.polarization.mean(), 3)}
        for m in models:
            neg, pos = g[g.polarization == 0], g[g.polarization == 1]
            row[f"{m}_acc"] = round((g[m] == g.polarization).mean(), 3)
            row[f"{m}_false_pos_rate"] = round((neg[m] == 1).mean(), 3) if len(neg) else np.nan
            row[f"{m}_false_neg_rate"] = round((pos[m] == 0).mean(), 3) if len(pos) else np.nan
        rows.append(row)
    return pd.DataFrame(rows)


def recall_by_label(t, labels, models):
    """Among polarized test sentences carrying a label: how many each model finds."""
    rows = []
    pos = t[t.polarization == 1]
    for c in labels:
        g = pos[pos[c] == 1]
        rows.append({"label": c, "n_polarized": len(g), **{f"{m}_recall": round((g[m] == 1).mean(), 3) for m in models}})
    none = pos[pos[labels].fillna(0).sum(1) == 0]
    rows.append({"label": "(no label given)", "n_polarized": len(none),
                 **{f"{m}_recall": round((none[m] == 1).mean(), 3) for m in models}})
    return pd.DataFrame(rows)


def task1_errors():
    t = test_metadata()
    val, test, C, pred, score, vec, model = fit_best("task1", "word+char")
    print(f"  TF-IDF word+char LogReg  C={C}  val {val:.4f}  test {test:.4f}")
    t["tfidf"], t["tfidf_score"] = pred, score
    models = ["tfidf"]
    f = PRED / "task1_bilstm_seed42.csv"
    if f.exists():
        t["bilstm"] = t.id.map(pd.read_csv(f).set_index("id").pred_polarization)
        models.append("bilstm")

    tables = {"confusion": pd.DataFrame([{
        "model": m, "macro_f1": round(f1_score(t.polarization, t[m], average="macro"), 4),
        "true_neg": int(((t[m] == 0) & (t.polarization == 0)).sum()), "false_pos": int(((t[m] == 1) & (t.polarization == 0)).sum()),
        "false_neg": int(((t[m] == 0) & (t.polarization == 1)).sum()), "true_pos": int(((t[m] == 1) & (t.polarization == 1)).sum()),
    } for m in models])}
    for by in ["length", "segmentation", "contributor"]:
        tables[f"by_{by}"] = breakdown(t, by, models)
    tables["recall_by_type"] = recall_by_label(t, TASKS["task2"], models)
    tables["recall_by_manifestation"] = recall_by_label(t[t.stereotype.notna()], TASKS["task3"], models)

    if "bilstm" in models:  # do the two models fail on the same sentences?
        a, b = t.tfidf != t.polarization, t.bilstm != t.polarization
        tables["overlap"] = pd.DataFrame([{"both_correct": int((~a & ~b).sum()), "only_tfidf_wrong": int((a & ~b).sum()),
                                           "only_bilstm_wrong": int((~a & b).sum()), "both_wrong": int((a & b).sum()),
                                           "oracle_acc_if_either_correct": round(1 - (a & b).mean(), 3)}])

    # strongest n-grams of a character-only model (the word+char union has two vocabularies)
    _, _, _, _, _, cvec, cmodel = fit_best("task1", "char (within tokens)")
    names, coef = np.array(cvec.get_feature_names_out()), cmodel.coef_[0]
    order = np.argsort(coef)
    tables["top_char_ngrams"] = pd.DataFrame({"polarized_ngram": names[order[::-1][:25]], "weight": coef[order[::-1][:25]].round(2),
                                              "not_polarized_ngram": names[order[:25]], "weight_": coef[order[:25]].round(2)})

    # the most confident mistakes, for reading
    wrong = t[t.tfidf != t.polarization].assign(confidence=lambda d: d.tfidf_score.abs())
    cols = ["id", "contributor", "polarization", "tfidf", *(["bilstm"] if "bilstm" in models else []), "confidence", "n_syll", "text"]
    tables["confident_errors"] = wrong.sort_values("confidence", ascending=False).head(60)[cols].round(3)
    return tables


# ---------------------------------------------------------------- C. Task 2 / 3 errors
def multilabel_errors(task):
    labels = TASKS[task]
    y = load(task)["test"][labels].values
    val, test, C, pred, *_ = fit_best(task, "char (within tokens)")
    print(f"  {task} TF-IDF char LinearSVC  C={C}  val {val:.4f}  test {test:.4f}")
    p, r, f, n = precision_recall_fscore_support(y, pred, average=None, zero_division=0)
    per = pd.DataFrame({"label": labels, "support": n, "predicted": pred.sum(0), "precision": p.round(3), "recall": r.round(3),
                        "f1": f.round(3), "false_pos": ((pred == 1) & (y == 0)).sum(0), "false_neg": ((pred == 0) & (y == 1)).sum(0)})
    # when a label is missed, what was predicted instead?
    rows = []
    for i, c in enumerate(labels):
        miss = (y[:, i] == 1) & (pred[:, i] == 0)
        row = {"missed_label": c, "n_missed": int(miss.sum()), "nothing_predicted": round((pred[miss].sum(1) == 0).mean(), 3)}
        row.update({f"pred_{o}": round(pred[miss, j].mean(), 3) for j, o in enumerate(labels) if j != i})
        rows.append(row)
    summary = pd.DataFrame([{"task": task, "exact_match": round((pred == y).all(1).mean(), 3),
                             "true_labels_per_sentence": round(y.sum(1).mean(), 3), "predicted_labels_per_sentence": round(pred.sum(1).mean(), 3),
                             "no_true_label": round((y.sum(1) == 0).mean(), 3), "no_predicted_label": round((pred.sum(1) == 0).mean(), 3)}])
    return {f"{task}_per_label": per, f"{task}_missed_instead": pd.DataFrame(rows), f"{task}_summary": summary}


if __name__ == "__main__":
    pd.set_option("display.width", 250, "display.max_columns", 30, "display.max_colwidth", 70)
    OUT.mkdir(parents=True, exist_ok=True)
    print("B. Task 1 errors")
    tables = task1_errors()
    print("C. Task 2 / Task 3 errors")
    for task in ["task2", "task3"]:
        tables.update(multilabel_errors(task))
    print("A. Text unit (TF-IDF + linear)")
    tables["unit_comparison_tfidf"] = unit_comparison()
    for name, df in tables.items():
        df.to_csv(OUT / f"{name}.csv", index=False, encoding="utf-8-sig")
        if name != "confident_errors":
            print(f"\n--- {name}\n{df.to_string(index=False)}")
