#!/usr/bin/env python3
"""
Convert myPOS format  →  CoNLL format (one token per line, word \t tag).
Handles compound tags like  ဘောဂ/n|ဗေဒ/n  by splitting on '|'.
"""

import sys

def parse_line(line):
    tokens = []
    for tok in line.strip().split():
        # Split compound words on '|':  ဘောဂ/n|ဗေဒ/n  →  ဘောဂ/n  +  ဗေဒ/n
        for part in tok.split('|'):
            if '/' not in part:
                continue
            idx = part.rfind('/')          # rfind: word may itself contain '/'
            word = part[:idx]
            tag  = part[idx + 1:]
            if word and tag:
                tokens.append((word, tag))
    return tokens

def main():
    inp, outp = sys.argv[1], sys.argv[2]
    with open(inp, encoding='utf-8') as f, \
         open(outp, 'w', encoding='utf-8') as out:
        for line in f:
            toks = parse_line(line)
            if not toks:
                continue
            for w, t in toks:
                out.write(f'{w}\t{t}\n')
            out.write('\n')          # blank line = sentence boundary
    print(f'[preprocess] {inp} → {outp}')

if __name__ == '__main__':
    main()
