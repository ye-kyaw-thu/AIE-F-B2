#!/usr/bin/env python3
"""Myanmar <-> Hiero NMT with Marian (runs Marian inside Docker)."""
import argparse
import os
import re
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "myhi_data"
DATA = ROOT / "data"
MODELS = ROOT / "models"
RESULTS = ROOT / "results"
TOOLS = ROOT / "tools"
IMAGE = os.environ.get("MARIAN_IMAGE", "assignment6-marian:cpu")
THREADS = os.environ.get("MARIAN_THREADS", "1")
BLEU_URL = "https://raw.githubusercontent.com/moses-smt/mosesdecoder/master/scripts/generic/multi-bleu.perl"
SPLITS = ("train", "valid", "test")
GAP = "▁"

SYL = re.compile(r"((?<!္)[က-အ](?![့]?[်္])|[ဣဤဥဦဧဩဪဿ၌၍၏၀-၉၊။])")

COMMON = [
    "--max-length", "100",
    "--valid-metrics", "bleu", "ce-mean-words", "perplexity",
    "--early-stopping", "8",
    "--keep-best",
    "--beam-size", "4",
    "--normalize", "0.6",
    "--valid-mini-batch", "32",
    "--quiet-translation",
    "--overwrite",
    "--seed", "1111",
]

EXPS = {
    "s2s": [
        "--type", "s2s",
        "--dim-emb", "128", "--dim-rnn", "256",
        "--enc-type", "bidirectional", "--enc-cell", "gru", "--dec-cell", "gru",
        "--enc-depth", "1", "--dec-depth", "1",
        "--dropout-rnn", "0.2", "--dropout-src", "0.1", "--dropout-trg", "0.1",
        "--tied-embeddings", "--layer-normalization",
        "--mini-batch", "64", "--learn-rate", "0.001",
    ],
    "tf": [
        "--type", "transformer",
        "--dim-emb", "256", "--transformer-dim-ffn", "1024",
        "--enc-depth", "2", "--dec-depth", "2", "--transformer-heads", "4",
        "--transformer-dropout", "0.1", "--label-smoothing", "0.1",
        "--tied-embeddings",
        "--mini-batch", "64", "--learn-rate", "0.0005",
        "--lr-warmup", "400", "--lr-decay-inv-sqrt", "400", "--clip-norm", "5",
    ],
}


def marian(cmd, log=None):
    full = ["docker", "run", "--rm", "--platform", "linux/amd64",
            "-e", "OPENBLAS_NUM_THREADS=1", "-e", "OMP_NUM_THREADS=1",
            "-v", f"{ROOT}:/workspace", "-w", "/workspace",
            "--entrypoint", "bash", IMAGE, "-c", cmd]
    if log is None:
        return subprocess.run(full, check=True)
    with open(log, "w") as f:
        return subprocess.run(full, check=True, stdout=f, stderr=subprocess.STDOUT)


def merge(*groups):
    opts = {}
    for group in groups:
        for item in group:
            if item.startswith("--"):
                key = item
                opts[key] = []
            else:
                opts[key].append(item)
    return [x for key, vals in opts.items() for x in (key, *vals)]


def rel(path):
    return str(Path(path).relative_to(ROOT))


def syllables(line):
    line = SYL.sub(r" \1", line)
    line = re.sub(r"([က-႟])([A-Za-z])", r"\1 \2", line)
    return " ".join(line.split())


def to_chars(line):
    return f" {GAP} ".join(" ".join(word) for word in line.split())


def from_chars(line):
    return " ".join(line.replace(" ", "").replace(GAP, " ").split())


def write(path, lines):
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def read(path):
    return path.read_text(encoding="utf-8").splitlines()


def prep(args):
    DATA.mkdir(exist_ok=True)
    for split in SPLITS:
        my = read(RAW / f"{split}.my")
        hi = read(RAW / f"{split}.hi")
        assert len(my) == len(hi), split
        write(DATA / f"{split}.my", [syllables(x) for x in my])
        write(DATA / f"{split}.hi", [" ".join(x.split()) for x in hi])
        write(DATA / f"{split}.hic", [to_chars(x) for x in hi])
        print(f"{split:5} {len(my):5} pairs")
    for ext in ("my", "hi", "hic"):
        marian(f"marian-vocab < data/train.{ext} > data/vocab.{ext}.yml 2>/dev/null")
        print(f"vocab.{ext}.yml {len(read(DATA / f'vocab.{ext}.yml'))}")
    bleu_script()


def bleu_script():
    path = TOOLS / "multi-bleu.perl"
    if not path.exists():
        TOOLS.mkdir(exist_ok=True)
        urllib.request.urlretrieve(BLEU_URL, path)
    return path


def sides(direction, hi):
    src, tgt = direction.split("-")
    ext = {"my": "my", "hi": "hic" if hi == "char" else "hi"}
    return ext[src], ext[tgt]


def model_dir(name, direction, hi):
    return MODELS / f"{name}.{hi}.{direction}"


def train(args):
    src, tgt = sides(args.direction, args.hi)
    out = model_dir(args.name, args.direction, args.hi)
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    o = rel(out)
    cmd = [
        "marian",
        "--model", f"{o}/model.npz",
        "--train-sets", f"data/train.{src}", f"data/train.{tgt}",
        "--valid-sets", f"data/valid.{src}", f"data/valid.{tgt}",
        "--vocabs", f"data/vocab.{src}.yml", f"data/vocab.{tgt}.yml",
        "--valid-translation-output", f"{o}/valid.output",
        "--log", f"{o}/train.log", "--valid-log", f"{o}/valid.log",
        "--valid-freq", args.valid_freq, "--save-freq", args.valid_freq,
        "--disp-freq", "100",
        "--after", args.after,
        "--cpu-threads", THREADS,
        *merge(COMMON, EXPS[args.base], args.extra),
    ]
    marian(" ".join(cmd), log=out / "stdout.log")
    print((out / "valid.log").read_text()[-600:])


def score(hyp, direction, hi, label):
    src, tgt = direction.split("-")
    lines = read(hyp)
    if tgt == "hi" and hi == "char":
        lines = [from_chars(x) for x in lines]
    final = hyp.with_suffix(".txt")
    write(final, lines)
    with open(final) as f:
        bleu = subprocess.run(["perl", str(bleu_script()), str(DATA / f"test.{tgt}")],
                              stdin=f, capture_output=True, text=True).stdout.strip()
    RESULTS.mkdir(exist_ok=True)
    with open(RESULTS / "bleu.tsv", "a") as f:
        f.write(f"{label}\t{direction}\t{bleu}\n")
    print(f"{label} {direction}: {bleu}")


def decode(models, direction, hi, hyp, weights=None):
    src, tgt = sides(direction, hi)
    cmd = ["marian-decoder", "-m", *models,
           "-v", f"data/vocab.{src}.yml", f"data/vocab.{tgt}.yml",
           "-i", f"data/test.{src}", "-o", rel(hyp),
           "--beam-size", "6", "--normalize", "0.6",
           "--mini-batch", "32", "--maxi-batch", "100",
           "--cpu-threads", "4", "--quiet"]
    if weights:
        cmd += ["--weights", *weights]
    marian(" ".join(cmd))


def test(args):
    out = model_dir(args.name, args.direction, args.hi)
    hyp = out / "test.hyp"
    decode([f"{rel(out)}/model.npz.best-bleu.npz"], args.direction, args.hi, hyp)
    score(hyp, args.direction, args.hi, f"{args.name}.{args.hi}")


def ensemble(args):
    out = MODELS / f"ensemble.{args.hi}.{args.direction}"
    out.mkdir(parents=True, exist_ok=True)
    models = [f"{rel(model_dir(n, args.direction, args.hi))}/model.npz.best-bleu.npz" for n in args.names]
    hyp = out / f"test.{'+'.join(args.names)}.hyp"
    decode(models, args.direction, args.hi, hyp, args.weights)
    score(hyp, args.direction, args.hi, f"ensemble({'+'.join(args.names)}).{args.hi}")


def report(args):
    best = {}
    for line in read(RESULTS / "bleu.tsv"):
        label, direction, bleu = line.split("\t")
        m = re.match(r"BLEU = ([\d.]+)", bleu)
        if m:
            best.setdefault(label, {})[direction] = m.group(1)
    print("| Model | my-hi | hi-my |")
    print("| --- | ---: | ---: |")
    for label, row in best.items():
        print(f"| {label} | {row.get('my-hi', '-')} | {row.get('hi-my', '-')} |")


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("prep").set_defaults(fn=prep)

    t = sub.add_parser("train")
    t.add_argument("name")
    t.add_argument("direction", choices=["my-hi", "hi-my"])
    t.add_argument("--base", choices=list(EXPS))
    t.add_argument("--hi", choices=["word", "char"], default="word")
    t.add_argument("--valid-freq", default="400")
    t.add_argument("--after", default="60e")
    t.set_defaults(fn=train)

    e = sub.add_parser("test")
    e.add_argument("name")
    e.add_argument("direction", choices=["my-hi", "hi-my"])
    e.add_argument("--hi", choices=["word", "char"], default="word")
    e.set_defaults(fn=test)

    s = sub.add_parser("ensemble")
    s.add_argument("direction", choices=["my-hi", "hi-my"])
    s.add_argument("names", nargs="+")
    s.add_argument("--hi", choices=["word", "char"], default="word")
    s.add_argument("--weights", nargs="+")
    s.set_defaults(fn=ensemble)

    sub.add_parser("report").set_defaults(fn=report)

    args, extra = p.parse_known_args()
    args.extra = extra
    if args.cmd == "train" and not args.base:
        args.base = args.name if args.name in EXPS else "tf"
    args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
