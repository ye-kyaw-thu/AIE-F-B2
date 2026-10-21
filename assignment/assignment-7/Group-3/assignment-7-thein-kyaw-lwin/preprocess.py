#!/usr/bin/env python3
"""
Preprocessing Pipeline for Assignment-7 (POLAR Benchmark - Myanmar Dataset)
Tasks:
  - Task 1: Polarization Detection (Binary)
  - Task 2: Polarization Type Classification (Multi-Label, 5 classes)
  - Task 3: Polarization Manifestation Identification (Multi-Label, 6 classes)

This script performs:
  1. Filtering out incomplete rows (e.g., 1,200 rows with missing Task 3 manifestations).
  2. Dropping Zawgyi-encoded rows (ensuring 100% verified Myanmar Unicode NFC).
  3. Unicode normalization (NFC), zero-width characters cleanup, and whitespace standardization.
  4. Deduplication and removal of conflicting/ambiguous samples.
  5. Grammar-informed word segmentation using `mmdt-tokenizer`.
  6. Exporting Format 1 (Full metadata archive) and Format 2 (Model-ready dataset).
  7. Iterative Multi-label Stratified Splitting into Train (80%), Val (10%), and Test (10%).
"""

import os
import csv
import re
import unicodedata
from collections import Counter, defaultdict
import numpy as np
import pandas as pd
from mmdt_tokenizer import MyanmarWordTokenizer
from iterstrat.ml_stratifiers import MultilabelStratifiedShuffleSplit

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_CSV = os.path.join(BASE_DIR, "assignment-7.csv")
DATA_DIR = os.path.join(BASE_DIR, "data")
FORMAT_1_CSV = os.path.join(DATA_DIR, "format_1_raw_archive.csv")
FORMAT_2_CSV = os.path.join(DATA_DIR, "format_2_cleaned_all.csv")
TRAIN_CSV = os.path.join(DATA_DIR, "train.csv")
VAL_CSV = os.path.join(DATA_DIR, "val.csv")
TEST_CSV = os.path.join(DATA_DIR, "test.csv")

# Label Definitions
TASK1_LABEL = ["polarization"]
TASK2_LABELS = ["political", "racial/ethnic", "religious", "gender/sexual", "other"]
TASK3_LABELS = [
    "stereotype", "vilification", "dehumanization",
    "extreme_language", "lack_of_empathy", "invalidation"
]
ALL_LABELS = TASK1_LABEL + TASK2_LABELS + TASK3_LABELS

# Known Zawgyi code point range
ZAWGYI_CODEPOINTS = set(range(0x1060, 0x1098))


def is_zawgyi(text: str) -> bool:
    """Detect if text contains Zawgyi-specific remapped characters."""
    return any(ord(c) in ZAWGYI_CODEPOINTS for c in text)


def clean_text_unicode(text: str) -> str:
    """Normalize Unicode and remove invisible control characters."""
    if not text:
        return ""
    # Unicode NFC normalization
    norm_text = unicodedata.normalize("NFC", text)
    # Remove zero-width spaces, BOM, and control characters
    norm_text = re.sub(r"[\u200b\u200c\u200d\ufeff]", "", norm_text)
    # Standardize whitespace (tabs, newlines, multiple spaces) to single space
    norm_text = re.sub(r"\s+", " ", norm_text).strip()
    return norm_text


def extract_annotator_name(orig_id: str) -> str:
    """Extract annotator name from original_id string."""
    if not orig_id:
        return "unknown"
    parts = orig_id.split("_")
    if len(parts) >= 3 and parts[0] == "mya":
        return parts[1]
    elif len(parts) == 2:
        return parts[0]
    return orig_id


def segment_words(tokenizer: MyanmarWordTokenizer, text: str) -> str:
    """Segment Myanmar text using mmdt-tokenizer."""
    # Remove existing spacing before segmentation to give tokenizer raw context
    no_space = text.replace(" ", "")
    if not no_space:
        return ""
    token_result = tokenizer.tokenize(no_space)
    if isinstance(token_result, list) and len(token_result) > 0 and isinstance(token_result[0], list):
        words = [w for sent in token_result for w in sent]
    elif isinstance(token_result, list):
        words = token_result
    else:
        words = [str(token_result)]
    # Join with single whitespace and clean
    return " ".join(words).strip()


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    print("=" * 70)
    print("Step 1: Data Preprocessing & Formatting Pipeline")
    print("=" * 70)

    # 1. Ingestion
    print(f"\n[1/7] Ingesting raw data from: {INPUT_CSV}")
    with open(INPUT_CSV, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        raw_rows = list(reader)
    print(f"  Total raw rows: {len(raw_rows):,}")

    # 2. Filter incomplete rows
    print("\n[2/7] Filtering qualified data (dropping incomplete rows)...")
    qualified_rows = []
    dropped_incomplete = 0
    for r in raw_rows:
        # Check if all 12 target columns exist and are either '0' or '1'
        if not r["original_id"].strip():
            dropped_incomplete += 1
            continue
        has_all_labels = all(r[col] in ("0", "1") for col in ALL_LABELS)
        if not has_all_labels:
            dropped_incomplete += 1
            continue
        qualified_rows.append(r)

    print(f"  Dropped incomplete rows: {dropped_incomplete:,}")
    print(f"  Retained fully-annotated rows: {len(qualified_rows):,}")

    # 3. Check and drop Zawgyi rows
    print("\n[3/7] Filtering encoding artifacts (Zawgyi codepoints)...")
    unicode_rows = []
    dropped_zawgyi = 0
    for r in qualified_rows:
        if is_zawgyi(r["text"]):
            dropped_zawgyi += 1
        else:
            unicode_rows.append(r)
    print(f"  Dropped Zawgyi rows: {dropped_zawgyi}")
    print(f"  Remaining pure Unicode rows: {len(unicode_rows):,}")

    # 4. Text cleaning & Deduplication
    print("\n[4/7] Cleaning text and resolving duplicates...")
    # Group by canonical whitespace-invariant text to catch sentences with differing manual space segmentations
    grouped = defaultdict(list)
    for r in unicode_rows:
        cleaned_t = clean_text_unicode(r["text"])
        r["cleaned_text"] = cleaned_t
        canonical_key = cleaned_t.replace(" ", "")
        grouped[canonical_key].append(r)

    deduped_rows = []
    conflicting_dropped = 0
    duplicate_merged = 0

    for canonical_text, group in grouped.items():
        if not canonical_text or len(canonical_text) < 2:
            continue
        # Check if polarization labels conflict
        pol_labels = set(item["polarization"] for item in group)
        if len(pol_labels) > 1:
            # Conflicting polarization ground truth -> drop all
            conflicting_dropped += len(group)
            continue

        if len(group) > 1:
            duplicate_merged += (len(group) - 1)

        # Pick the representative row (prefer richer key_phrase and label consistency)
        best_row = max(group, key=lambda x: (len(x.get("key_phrase", "").strip()), sum(int(x[col]) for col in ALL_LABELS)))
        deduped_rows.append(best_row)

    print(f"  Dropped conflicting duplicate instances: {conflicting_dropped}")
    print(f"  Merged identical duplicate instances: {duplicate_merged}")
    print(f"  Clean distinct samples remaining: {len(deduped_rows):,}")

    # 5. Grammar-informed Word Segmentation with mmdt-tokenizer
    print("\n[5/7] Running grammar-informed word segmentation (mmdt-tokenizer)...")
    tokenizer = MyanmarWordTokenizer()
    for i, r in enumerate(deduped_rows):
        r["segmented_text"] = segment_words(tokenizer, r["cleaned_text"])
        if (i + 1) % 2500 == 0 or (i + 1) == len(deduped_rows):
            print(f"  Segmented {i + 1:,} / {len(deduped_rows):,} sentences...")

    # Canonical post-segmentation deduplication to guarantee 100% zero overlap
    seg_grouped = defaultdict(list)
    for r in deduped_rows:
        seg_grouped[r["segmented_text"]].append(r)

    final_rows = []
    for seg_text, group in seg_grouped.items():
        pol_labels = set(item["polarization"] for item in group)
        if len(pol_labels) > 1:
            continue
        best_row = max(group, key=lambda x: (len(x.get("key_phrase", "").strip()), sum(int(x[col]) for col in ALL_LABELS)))
        final_rows.append(best_row)

    print(f"  Final strictly unique segmented samples: {len(final_rows):,}")

    # 6. Generate Format 1 & Format 2
    print("\n[6/7] Exporting Format 1 and Format 2 datasets...")
    # Prepare Format 1 (Full Archive with Provenance)
    format1_data = []
    for r in final_rows:
        f1_row = {
            "original_id": r["original_id"],
            "annotator": extract_annotator_name(r["original_id"]),
            "id": r["id"],
            "text": r["segmented_text"],
            "key_phrase": r.get("key_phrase", ""),
        }
        for col in ALL_LABELS:
            f1_row[col] = int(r[col])
        format1_data.append(f1_row)

    df_format1 = pd.DataFrame(format1_data)
    df_format1.to_csv(FORMAT_1_CSV, index=False, encoding="utf-8")
    print(f"  Saved Format 1 (Archive): {FORMAT_1_CSV} ({len(df_format1):,} rows)")

    # Prepare Format 2 (Model Ready)
    format2_cols = ["id", "text"] + ALL_LABELS
    df_format2 = df_format1[format2_cols].copy()
    df_format2.to_csv(FORMAT_2_CSV, index=False, encoding="utf-8")
    print(f"  Saved Format 2 (Model Ready): {FORMAT_2_CSV} ({len(df_format2):,} rows)")

    # 7. Multi-Label Stratified Splitting (80% Train, 10% Val, 10% Test)
    print("\n[7/7] Performing Multi-Label Stratified Split (80% Train / 10% Val / 10% Test)...")
    X = df_format2[["id", "text"]].values
    Y = df_format2[ALL_LABELS].values.astype(int)

    # First split: 80% Train, 20% Temp
    msss_train = MultilabelStratifiedShuffleSplit(n_splits=1, test_size=0.20, random_state=42)
    train_idx, temp_idx = next(msss_train.split(X, Y))

    # Second split: Split 20% Temp into 50% Val (10% total) and 50% Test (10% total)
    X_temp, Y_temp = X[temp_idx], Y[temp_idx]
    msss_val_test = MultilabelStratifiedShuffleSplit(n_splits=1, test_size=0.50, random_state=42)
    val_sub_idx, test_sub_idx = next(msss_val_test.split(X_temp, Y_temp))

    val_idx = temp_idx[val_sub_idx]
    test_idx = temp_idx[test_sub_idx]

    df_train = df_format2.iloc[train_idx].copy().reset_index(drop=True)
    df_val = df_format2.iloc[val_idx].copy().reset_index(drop=True)
    df_test = df_format2.iloc[test_idx].copy().reset_index(drop=True)

    df_train.to_csv(TRAIN_CSV, index=False, encoding="utf-8")
    df_val.to_csv(VAL_CSV, index=False, encoding="utf-8")
    df_test.to_csv(TEST_CSV, index=False, encoding="utf-8")

    print(f"  Saved Train Split: {TRAIN_CSV} ({len(df_train):,} samples, {len(df_train)/len(df_format2)*100:.1f}%)")
    print(f"  Saved Val Split:   {VAL_CSV} ({len(df_val):,} samples, {len(df_val)/len(df_format2)*100:.1f}%)")
    print(f"  Saved Test Split:  {TEST_CSV} ({len(df_test):,} samples, {len(df_test)/len(df_format2)*100:.1f}%)")

    # Verification Report
    print("\n" + "=" * 70)
    print("Stratification Distribution Verification Table")
    print("=" * 70)
    print(f"{'Label Name':<20} | {'All (%)':<10} | {'Train (%)':<10} | {'Val (%)':<10} | {'Test (%)':<10}")
    print("-" * 70)
    for col in ALL_LABELS:
        all_pct = df_format2[col].mean() * 100
        tr_pct = df_train[col].mean() * 100
        val_pct = df_val[col].mean() * 100
        te_pct = df_test[col].mean() * 100
        print(f"{col:<20} | {all_pct:6.2f}%    | {tr_pct:6.2f}%    | {val_pct:6.2f}%    | {te_pct:6.2f}%")
    print("=" * 70)
    print("Data Preprocessing & Formatting Complete!")


if __name__ == "__main__":
    main()

