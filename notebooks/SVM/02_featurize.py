#!/usr/bin/env python3
"""
Extract word-level features and write libsvm-format files for LIBLINEAR.
Labels are 1-indexed (1 to K) as required by LIBLINEAR.
"""

import sys
import pickle

def read_conll(path):
    sents, cur = [], []
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n')
            if not line.strip():
                if cur:
                    sents.append(cur)
                    cur = []
            else:
                w, t = line.split('\t')
                cur.append((w, t))
    if cur:
        sents.append(cur)
    return sents

def extract_features(sent, i):
    """Return list of string features for token at position i."""
    word = sent[i][0]
    feats = []
    feats.append(f'w={word}')
    for n in (1, 2, 3):
        if len(word) >= n:
            feats.append(f'p{n}={word[:n]}')
            feats.append(f's{n}={word[-n:]}')
    feats.append(f'has_digit={any(c.isdigit() for c in word)}')
    feats.append(f'len={min(len(word), 10)}')
    
    # context words
    if i > 0:
        feats.append(f'w-1={sent[i-1][0]}')
    if i > 1:
        feats.append(f'w-2={sent[i-2][0]}')
    if i < len(sent) - 1:
        feats.append(f'w+1={sent[i+1][0]}')
    if i < len(sent) - 2:
        feats.append(f'w+2={sent[i+2][0]}')
        
    # surrounding word bigram
    if 0 < i < len(sent) - 1:
        feats.append(f'w-1_w+1={sent[i-1][0]}|{sent[i+1][0]}')
    return feats

class Vocab:
    def __init__(self):
        self.feat2id  = {}     # feature string → int (1-indexed)
        self.label2id = {}     # tag string → int (1-indexed)
        self.id2label = []     # int → tag string (0-indexed list)
        
    def add_feat(self, f):
        if f not in self.feat2id:
            self.feat2id[f] = len(self.feat2id) + 1
            
    def get_feat(self, f):
        return self.feat2id.get(f, -1)
        
    def add_label(self, l):
        if l not in self.label2id:
            self.label2id[l] = len(self.id2label) + 1  # 1-indexed label
            self.id2label.append(l)
            
    def get_label(self, l):
        return self.label2id.get(l, -1)

def main():
    mode        = sys.argv[1]   # 'train' or 'test'
    conll_path  = sys.argv[2]
    out_path    = sys.argv[3]
    vocab_path  = sys.argv[4]

    sents = read_conll(conll_path)

    if mode == 'train':
        vocab = Vocab()
        for sent in sents:
            for i in range(len(sent)):
                for f in extract_features(sent, i):
                    vocab.add_feat(f)
                vocab.add_label(sent[i][1])
        with open(vocab_path, 'wb') as vf:
            pickle.dump(vocab, vf)
        print(f'[featurize] vocab size: {len(vocab.feat2id)} feats, '
              f'{len(vocab.id2label)} labels')
    else:
        with open(vocab_path, 'rb') as vf:
            vocab = pickle.load(vf)

    with open(out_path, 'w', encoding='utf-8') as out:
        for sent in sents:
            for i in range(len(sent)):
                feats = extract_features(sent, i)
                # Use a set to remove duplicate feature IDs, then sort for libsvm format
                ids = sorted({vocab.get_feat(f) for f in feats if vocab.get_feat(f) > 0})
                
                # ALWAYS output the true label (1-indexed) 
                # Even for test set, so liblinear predict can calculate accuracy automatically
                label = vocab.get_label(sent[i][1])
                feat_str = ' '.join(f'{fid}:1' for fid in ids)
                
                # Write label followed by space-separated features
                out.write(f'{label} {feat_str}\n')
                
    print(f'[featurize] {mode}: {conll_path} → {out_path}')

if __name__ == '__main__':
    main()

