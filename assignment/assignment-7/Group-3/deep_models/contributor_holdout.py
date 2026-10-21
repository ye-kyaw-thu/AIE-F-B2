"""
contributor_holdout.py - Task 1 split where whole contributors are held out.

The standard splits are random, so every contributor's sentences appear in
train, val and test. Because the polarization rate differs a lot between
contributors (0% to 99%), a model can score well by recognising a
contributor's source and style. This script builds a split in which the test
and validation contributors are never seen in training, and scores the TF-IDF
baseline on it. The neural models are run on the same split with

    python polar_models.py --model <m> --task task1 \
        --splits splits_contributor --out results/contributor_holdout.csv
"""
from pathlib import Path

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score
from sklearn.model_selection import GroupShuffleSplit

HERE = Path(__file__).resolve().parent
FINAL = HERE.parent / "final"
OUT = HERE / "splits_contributor"
SEED = 42


def contributor(original_id: pd.Series) -> pd.Series:
    s = original_id.fillna("unknown")  # the two files without original_id share the same sentences
    s = s.where(~s.str.match(r"^mya_[0-9a-f]{20,}$"), "mya_phyomyatoo")  # hash-style ids
    s = s.str.replace(r"[_-]?\d+$", "", regex=True).str.replace(r"-\d+$", "", regex=True)
    return s.replace({"mya_khinezarthwe": "mya_khine"})


if __name__ == "__main__":
    t1 = pd.read_csv(FINAL / "task1_polarization.csv")
    fin = pd.read_csv(FINAL / "final_dataset.csv")
    groups = contributor(t1.id.map(fin.set_index("id").original_id))

    rest, test = next(GroupShuffleSplit(1, test_size=0.2, random_state=SEED).split(t1, groups=groups))
    tr, va = next(GroupShuffleSplit(1, test_size=0.15, random_state=SEED).split(rest, groups=groups.iloc[rest]))
    parts = {"train": t1.iloc[rest[tr]], "val": t1.iloc[rest[va]], "test": t1.iloc[test]}
    OUT.mkdir(exist_ok=True)
    for name, df in parts.items():
        df.to_csv(OUT / f"task1_{name}.csv", index=False, encoding="utf-8-sig")
        print(f"{name:5s} n={len(df):5d}  polarized={df.polarization.mean():.3f}  "
              f"contributors={sorted(groups.loc[df.index].unique())}")

    # TF-IDF baseline (same features as the best Task 1 baseline), C chosen on validation
    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=2, sublinear_tf=True, max_features=200_000)
    X = {"train": vec.fit_transform(parts["train"].text)}
    X.update({s: vec.transform(parts[s].text) for s in ["val", "test"]})
    best = (-1, None, None)
    for C in [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30, 100]:
        m = LogisticRegression(C=C, class_weight="balanced", max_iter=2000, solver="liblinear", random_state=SEED)
        m.fit(X["train"], parts["train"].polarization)
        val = f1_score(parts["val"].polarization, m.predict(X["val"]), average="macro")
        if val > best[0]:
            best = (val, C, f1_score(parts["test"].polarization, m.predict(X["test"]), average="macro"))
    row = {"task": "task1", "model": f"tfidf_char_logreg(C={best[1]})", "seed": SEED, "best_epoch": "",
           "val_macro_f1": round(best[0], 4), "test_macro_f1": round(best[2], 4), "per_label_test_f1": "{}"}
    print(row)
    out = HERE / "results" / "contributor_holdout.csv"
    pd.DataFrame([row]).to_csv(out, mode="a", header=not out.exists(), index=False)
