#!/usr/bin/env python3
import pandas as pd

for path in ["csv/train.csv", "csv/test.csv"]:
    print("=" * 70)
    print("FILE:", path)
    df = pd.read_csv(path)                 # <-- default: na_values applied
    print("shape         :", df.shape)
    print("dtypes        :")
    print(df.dtypes)
    print("NaN in text   :", df["text"].isna().sum())
    print("NaN in label  :", df["label"].isna().sum())
    print("Unique labels :", df["label"].unique()[:30])

    bad = df[df["label"].isna()]
    if not bad.empty:
        print("\n>> Rows with NaN label:")
        print(bad.head(20).to_string())
