#!/usr/bin/env python3
import sys
import argparse

def main():
    parser = argparse.ArgumentParser(
        description="Add a frequency column (always 1) to each line."
    )
    parser.add_argument(
        '--output', '-o',
        help="Output file path. If not specified, print to stdout."
    )
    args = parser.parse_args()

    # Open output file if provided, else use stdout
    out_fh = open(args.output, 'w', encoding='utf-8') if args.output else sys.stdout

    try:
        for line in sys.stdin:
            line = line.rstrip('\n')          # remove trailing newline only
            # Write the original line, a tab, and '1', then newline
            out_fh.write(line + '\t1\n')
    finally:
        if args.output:
            out_fh.close()

if __name__ == '__main__':
    main()

