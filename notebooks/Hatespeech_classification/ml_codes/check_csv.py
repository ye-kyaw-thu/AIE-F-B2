#!/usr/bin/env python3
"""
check_csv.py — Inspect a CSV file for common problems:

    * blank lines
    * lines with more than one comma (field-separator issue)
    * lines that parse to more than two fields

Usage
-----
    python check_csv.py -i train.csv
    python check_csv.py -i train.csv -o check_report.txt
    python check_csv.py -i train.csv --no_header
"""

import argparse
import csv
import sys


def check_csv(input_path: str,
              output_path: str = None,
              has_header: bool = True):
    """
    Read `input_path` and report anomalies.  If `output_path` is given,
    write the report there; otherwise write to stdout.
    """
    out = open(output_path, "w", encoding="utf-8") if output_path else sys.stdout

    total_lines = 0
    blank_lines = 0
    multi_comma_lines = 0
    multi_field_lines = 0

    try:
        with open(input_path, "r", encoding="utf-8", newline="") as fin:
            for lineno, raw in enumerate(fin, start=1):
                # Remove only the trailing newline; keep everything else intact
                line = raw.rstrip("\r\n")
                total_lines += 1

                # --- Skip header if requested -------------------------------
                if has_header and lineno == 1:
                    continue

                # --- Blank line check ---------------------------------------
                if line.strip() == "":
                    blank_lines += 1
                    out.write(f"[BLANK]  line {lineno}\n")
                    continue

                # --- Count commas in the raw line ---------------------------
                comma_count = line.count(",")

                # --- Parse using csv module to count fields properly --------
                try:
                    fields = next(csv.reader([line]))
                except csv.Error as e:
                    out.write(f"[CSV-ERROR] line {lineno}: {e} | {line}\n")
                    continue

                field_count = len(fields)

                # --- Report -------------------------------------------------
                problems = []
                if comma_count > 1:
                    problems.append(f"commas={comma_count}")
                    multi_comma_lines += 1
                if field_count > 2:
                    problems.append(f"fields={field_count}")
                    multi_field_lines += 1

                if problems:
                    flag = ", ".join(problems)
                    out.write(f"[LINE {lineno}] ({flag}): {line}\n")

        # --- Summary --------------------------------------------------------
        out.write("\n" + "=" * 60 + "\n")
        out.write(f"File          : {input_path}\n")
        out.write(f"Total lines   : {total_lines}\n")
        out.write(f"Blank lines   : {blank_lines}\n")
        out.write(f">1 comma      : {multi_comma_lines}\n")
        out.write(f">2 fields     : {multi_field_lines}\n")
        out.write("=" * 60 + "\n")
    finally:
        if output_path:
            out.close()


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Check a CSV file for blank lines, more-than-one-comma "
                    "lines, and lines with more than two fields."
    )
    p.add_argument(
        "-i", "--input",
        required=True,
        help="Path to the input CSV file (e.g. train.csv)."
    )
    p.add_argument(
        "-o", "--output",
        default=None,
        help="Path to the output report file. If omitted, results are "
             "printed to stdout."
    )
    p.add_argument(
        "--no_header",
        action="store_true",
        help="Treat the file as having NO header row "
             "(by default, line 1 is treated as a header and skipped)."
    )
    return p


def main():
    parser = build_arg_parser()
    args = parser.parse_args()

    try:
        check_csv(
            input_path=args.input,
            output_path=args.output,
            has_header=not args.no_header,
        )
    except FileNotFoundError as e:
        print(f"[ERROR] File not found: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
