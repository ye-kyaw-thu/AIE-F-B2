#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""sylbreak4all: regex-based syllable breaking for nine Myanmar languages."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import TextIO

MY_CONSONANT = r"က-အ"
EN_CHAR = r"a-zA-Z0-9"
SS_SYMBOL = "္"
ATHAT = "်"
OTHER_CHAR = r"ဣဤဥဦဧဩဪဿ၌၍၎၏၀-၉႐-႙၊။!-/:-@[-`’“”{-~\s…"

SH_CONSONANT = r"ၵၶငၸသၺတထၼပၽၾမယရလဝႁဢၹၷႀၻၿ"
OTHER_SH = r"႟႐-႙၊။!-/:-@[-`{-~\s"
SK_CONSONANT = r"ကခဂဃငစဆဇညတထဒနပဖဘမယရလဝသဟအဧ"
OTHER_SK = r"ဒမၡဧ၀-၉၊။!-/:-@[( -`{-~\s".replace(" ", "")
OTHER_PK = r"ၥၦၡဧ၀-၉၊။!-/:-@[( -`{-~\s".replace(" ", "")
MO_CONSONANT = r"ကခဂဃၚစဆဇၛဉညဋဌဍဎဏတထဒဓနပဖဗဘမယရလဝသဟဠၜအၝ"


def compile_patterns() -> dict[str, re.Pattern[str]]:
    common = rf"((?<!{SS_SYMBOL})[{MY_CONSONANT}](?![{ATHAT}{SS_SYMBOL}])|[{EN_CHAR}{OTHER_CHAR}])"
    return {
        "bm": re.compile(common),
        "rk": re.compile(common),
        "dw": re.compile(common),
        "bk": re.compile(common),
        "po": re.compile(common),
        "sh": re.compile(rf"([{SH_CONSONANT}](?![{ATHAT}])|[{EN_CHAR}{OTHER_SH}])"),
        "sk": re.compile(rf"([{SK_CONSONANT}]|[{EN_CHAR}{OTHER_SK}])"),
        "pk": re.compile(rf"([{MY_CONSONANT}]|[{EN_CHAR}{OTHER_PK}])"),
        "mo": re.compile(rf"((?<!{SS_SYMBOL})[{MO_CONSONANT}](?![{ATHAT}{SS_SYMBOL}])|[{EN_CHAR}{OTHER_CHAR}])"),
    }


def segment_line(line: str, pattern: re.Pattern[str], separator: str) -> str:
    # Match the historical sylbreak4all reference behavior: phrase whitespace is
    # removed before applying the syllable-breaking RE.
    line = re.sub(r"\s+", "", line)
    output = pattern.sub(lambda m: separator + m.group(1), line)
    return re.sub(r"^\s+|\s+$", "", output)


def open_input(path: str | None) -> TextIO:
    if path is None:
        return sys.stdin
    return Path(path).open("r", encoding="utf-8")


HELP_TEXT = """Syllable Breaker Tool
Version: 0.9.0

Supported Languages:
    bm  - Burmese
    bk  - Beik
    dw  - Dawei
    rk  - Rakhine
    mo  - Mon
    po  - PaO
    sh  - Shan
    sk  - Sgaw Kayin
    pk  - Pwo Kayin

Usage: sylbreak4all [-i filename] [-l language] [-s separator] [-p]
    -i | --input-file   Input file name (default: STDIN)
    -s | --separator    Separator (default: '|')
    -l | --language     Language (default: bm for Burmese)
    -p | --print        Print input alongside the output (default: 0)
    -h | --help         Show this help
"""

def print_help(stream: TextIO = sys.stdout) -> None:
    print(HELP_TEXT, end="", file=stream)

def main() -> int:
    input_file = None
    separator = "|"
    language = "bm"
    print_input = False
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        arg = args[i]
        if arg in ("-h", "--help"):
            print_help()
            return 0
        if arg in ("-i", "--input", "--input-file"):
            i += 1
            if i >= len(args):
                print("Missing value for -i/--input-file", file=sys.stderr)
                print_help(sys.stderr)
                return 1
            input_file = args[i]
        elif arg in ("-s", "--separator"):
            i += 1
            if i >= len(args):
                print("Missing value for -s/--separator", file=sys.stderr)
                print_help(sys.stderr)
                return 1
            separator = args[i]
        elif arg in ("-l", "--language", "--lang"):
            i += 1
            if i >= len(args):
                print("Missing value for -l/--language", file=sys.stderr)
                print_help(sys.stderr)
                return 1
            language = args[i]
        elif arg in ("-p", "--print"):
            print_input = True
        else:
            print(f"Unknown argument: {arg}", file=sys.stderr)
            print_help(sys.stderr)
            return 1
        i += 1

    patterns = compile_patterns()
    if language not in patterns:
        print(f"Unsupported language: {language}", file=sys.stderr)
        print_help(sys.stderr)
        return 1

    fh = open_input(input_file)
    try:
        for raw_line in fh:
            line = raw_line.rstrip("\r\n")
            output = segment_line(line, patterns[language], separator)
            if print_input:
                clean = re.sub(r"\s+", "", line)
                print(f"input: {clean}")
                print(f"output: {output}")
            else:
                print(output)
    finally:
        if fh is not sys.stdin:
            fh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
