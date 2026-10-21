#!/usr/bin/env python3
"""
pkl2txt.py - Convert a pickle (.pkl) file to a plain text format.

Usage:
    python pkl2txt.py -i vocab.pkl
    python pkl2txt.py -i vocab.pkl -o vocab.txt
    python pkl2txt.py --input vocab.pkl --output vocab.txt
"""

import argparse
import pickle
import sys
from pprint import pformat


# --- Custom Class Definition required to unpickle the object ---
# This must match the class definition from 02_featurize.py
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
# --------------------------------------------------------------


def load_pkl(path):
    """Load a pickle file and return the object inside."""
    try:
        with open(path, "rb") as f:
            return pickle.load(f)
    except FileNotFoundError:
        sys.stderr.write(f"[ERROR] File not found: {path}\n")
        sys.exit(1)
    except pickle.UnpicklingError as e:
        sys.stderr.write(f"[ERROR] Could not unpickle file '{path}': {e}\n")
        sys.exit(1)
    except Exception as e:
        sys.stderr.write(f"[ERROR] Failed to load '{path}': {e}\n")
        sys.exit(1)


def object_to_text(obj, sep="\t"):
    """
    Convert a Python object into plain text lines.
    Specifically formats the Vocab object, and falls back to generic formatting
    for dictionaries, lists, or other objects.
    """
    lines = []

    if isinstance(obj, Vocab):
        lines.append("# === Feat2ID (feature string -> int) ===")
        for k, v in obj.feat2id.items():
            lines.append(f"{k}{sep}{v}")
        
        lines.append("\n# === Label2ID (tag string -> int) ===")
        for k, v in obj.label2id.items():
            lines.append(f"{k}{sep}{v}")
            
        lines.append("\n# === ID2Label (int -> tag string) ===")
        # id2label is a 0-indexed list, but labels are 1-indexed in Vocab
        for i, v in enumerate(obj.id2label, start=1):
            lines.append(f"{i}{sep}{v}")

    elif isinstance(obj, dict):
        for k, v in obj.items():
            lines.append(f"{k}{sep}{v}")
    elif isinstance(obj, (list, tuple)):
        for item in obj:
            lines.append(str(item))
    elif isinstance(obj, set):
        for item in sorted(obj, key=lambda x: str(x)):
            lines.append(str(item))
    else:
        # Fallback: pretty-print the object so it remains readable
        lines = pformat(obj).splitlines()

    return "\n".join(lines)


def write_output(text, output_path):
    """Write text to a file or to stdout if no output path is given."""
    if output_path:
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(text)
                if not text.endswith("\n"):
                    f.write("\n")
            sys.stderr.write(f"[INFO] Output written to: {output_path}\n")
        except Exception as e:
            sys.stderr.write(f"[ERROR] Failed to write output '{output_path}': {e}\n")
            sys.exit(1)
    else:
        # Default: print to screen
        print(text)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Convert a pickle (.pkl) file to plain text format.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "-i", "--input",
        required=True,
        help="Path to the input .pkl file.",
    )
    parser.add_argument(
        "-o", "--output",
        default=None,
        help="Path to the output text file. If not given, prints to stdout.",
    )
    parser.add_argument(
        "--sep",
        default="\t",
        help="Separator between key and value for dict-like objects (default: TAB).",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    obj = load_pkl(args.input)
    text = object_to_text(obj, sep=args.sep)
    write_output(text, args.output)


if __name__ == "__main__":
    main()

