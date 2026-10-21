#!/usr/bin/env python3
"""
Convert a fastText-format file (e.g. `__label__ab some text here`)
into a CSV file with two columns: text,label

Usage examples:
    python fasttext_to_csv.py -f ltrain.txt -c ltrain.csv
    python fasttext_to_csv.py --fasttext_filename ltest.txt --csv_filename ltest.csv
"""

import argparse
import csv
import sys

LABEL_PREFIX = "__label__"


def parse_fasttext_line(line: str):
    """
    Parse a single line of fastText data.

    Returns a tuple (labels, text) where:
        labels : list of label strings (without the __label__ prefix)
        text   : the remaining text
    Returns None if the line is empty or contains no label.
    """
    line = line.rstrip("\r\n")
    if not line.strip():
        return None

    labels = []
    # Extract all leading __label__ tokens
    while line.startswith(LABEL_PREFIX):
        parts = line.split(" ", 1)
        label_token = parts[0]
        labels.append(label_token[len(LABEL_PREFIX):])
        line = parts[1] if len(parts) > 1 else ""
        # Skip a single separating space if present
        if line.startswith(" "):
            line = line[1:]

    if not labels:
        return None

    text = line.strip()
    return labels, text


def convert_fasttext_to_csv(fasttext_filename: str,
                            csv_filename: str,
                            label_sep: str = " ",
                            include_header: bool = True):
    """
    Convert fastText file to CSV.

    :param fasttext_filename: path to input fastText file
    :param csv_filename:      path to output CSV file
    :param label_sep:         separator to join multiple labels (default: space)
    :param include_header:    whether to write the `text,label` header row
    """
    total, written = 0, 0
    with open(fasttext_filename, "r", encoding="utf-8") as fin, \
         open(csv_filename, "w", encoding="utf-8", newline="") as fout:

        writer = csv.writer(fout, quoting=csv.QUOTE_MINIMAL)
        if include_header:
            writer.writerow(["text", "label"])

        for raw_line in fin:
            total += 1
            parsed = parse_fasttext_line(raw_line)
            if parsed is None:
                # Skip blank lines or lines without labels
                continue
            labels, text = parsed
            writer.writerow([text, label_sep.join(labels)])
            written += 1

    print(f"[OK] Read {total} lines, wrote {written} rows to '{csv_filename}'.")


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Convert a fastText-format file into a CSV file with "
                    "columns 'text' and 'label'."
    )
    parser.add_argument(
        "-f", "--fasttext_filename",
        required=True,
        help="Path to the input fastText file (e.g. ltrain.txt)."
    )
    parser.add_argument(
        "-c", "--csv_filename",
        required=True,
        help="Path to the output CSV file (e.g. ltrain.csv)."
    )
    parser.add_argument(
        "--label_sep",
        default=" ",
        help="Separator used when a line has multiple labels (default: space)."
    )
    parser.add_argument(
        "--no_header",
        action="store_true",
        help="Do not write the 'text,label' header row."
    )
    return parser


def main():
    parser = build_arg_parser()
    args = parser.parse_args()

    try:
        convert_fasttext_to_csv(
            fasttext_filename=args.fasttext_filename,
            csv_filename=args.csv_filename,
            label_sep=args.label_sep,
            include_header=not args.no_header,
        )
    except FileNotFoundError as e:
        print(f"[ERROR] File not found: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

