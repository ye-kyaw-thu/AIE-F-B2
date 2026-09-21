#!/usr/bin/env python3
"""
Evaluate LIBLINEAR predictions against gold CoNLL file.
Outputs overall accuracy and per-tag precision / recall / F1.
"""

import sys
import pickle
from collections import Counter

# Define the Vocab class so pickle can successfully unpickle the object
class Vocab:
    pass

def read_gold_tags(path):
    tags = []
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n')
            if not line.strip():
                continue
            parts = line.split('\t')
            tags.append(parts[1])
    return tags

def read_pred_ids(path):
    ids = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            ids.append(int(line))
    return ids

def main():
    gold_path, pred_path, vocab_path = sys.argv[1], sys.argv[2], sys.argv[3]
    
    with open(vocab_path, 'rb') as f:
        vocab = pickle.load(f)
    id2label = vocab.id2label

    gold_tags = read_gold_tags(gold_path)
    pred_ids  = read_pred_ids(pred_path)
    
    # Convert 1-indexed prediction IDs back to string tags
    # (label ID 1 is at index 0 in id2label list)
    pred_tags = [id2label[i-1] if 0 < i <= len(id2label) else 'UNK'
                 for i in pred_ids]

    assert len(gold_tags) == len(pred_tags), \
        f'Length mismatch: gold={len(gold_tags)} pred={len(pred_tags)}'

    # ---- Overall accuracy ----
    correct = sum(g == p for g, p in zip(gold_tags, pred_tags))
    total   = len(gold_tags)
    print(f'\n=== Overall Accuracy ===')
    print(f'  {correct}/{total} = {correct/total*100:.2f}%\n')

    # ---- Per-tag P / R / F1 ----
    tp = Counter()
    fp = Counter()
    fn = Counter()
    
    for g, p in zip(gold_tags, pred_tags):
        if g == p:
            tp[g] += 1
        else:
            fp[p] += 1
            fn[g] += 1

    all_tags = sorted(set(gold_tags) | set(pred_tags))
    print(f'{"Tag":<10} {"Precision":>10} {"Recall":>10} {"F1":>10} '
          f'{"TP":>6} {"FP":>6} {"FN":>6}')
    print('-' * 64)

    macro_f1 = 0.0
    for tag in all_tags:
        p = tp[tag] / (tp[tag] + fp[tag]) if (tp[tag] + fp[tag]) > 0 else 0
        r = tp[tag] / (tp[tag] + fn[tag]) if (tp[tag] + fn[tag]) > 0 else 0
        f1 = 2*p*r / (p+r) if (p+r) > 0 else 0
        macro_f1 += f1
        print(f'{tag:<10} {p*100:>9.2f}% {r*100:>9.2f}% {f1*100:>9.2f}% '
              f'{tp[tag]:>6} {fp[tag]:>6} {fn[tag]:>6}')

    print('-' * 64)
    print(f'{"Macro-F1":<10} {"":>10} {"":>10} '
          f'{macro_f1/len(all_tags)*100:>9.2f}%')

if __name__ == '__main__':
    main()

