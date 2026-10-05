#!/usr/bin/env python3
"""
mm_demo.py
Written by Ye Kyaw Thu, LU Lab., Myammar.
Last updated: 30 Sept 2025
For Talk@MyanmarSarYatWon.

Myanmar NLP demo CLI with Hugging Face models.
Includes automatic /tmp disk space check:
- If /tmp is full (0 bytes free), prints a warning.
- Redirects TMPDIR to ./tmp under current directory.

Tasks:
  - generate (text generation)
  - summarize (summarization)
  - translate (machine translation)
  - ner (named entity recognition)
  - sim (sentence similarity)
  - spellcheck (spelling correction)

Example Running:
# Generate  
python mm_demo.py generate --text "မင်္ဂလာပါ" --max-length 80

# Summary
python mm_demo.py summarize --text-file ./data/article-1.txt --max-length 50  

# Translation
time python mm_demo.py translate --src eng_Latn --tgt mya_Mymr --text "Hello, how are you?"  
# NER (named-entity recognition)
python mm_demo.py ner --text "ရန်ကုန်မြို့တွင် ကုမ္ပဏီ XYZ သည် မကြာသေးမီက ပြသခဲ့သည်"  

# Sentence similarity (paraphrase detector)
python mm_demo.py sim --text1 "ကျွန်တော် စာသင်တန်းသွားခဲ့တယ်" --text2 "ကျွန်တော် အတန်းသွားတယ်"  

# Spell correction (requires a dict file: wrong<TAB>correct OR term<TAB>freq)
python mm_demo.py spellcheck --word "မဂၤလာ" --dict ./data/spell_pair.txt
python mm_demo.py spellcheck     --word "လူဆိုးးး"     --dict ./data/g2p.freq     --mode fuzzy     --max-edit-distance 5     --num-suggestions 10


# Put --device before the subcommand:

python mm_demo.py --device 0 spellcheck \
    --word "လူဆိုးးး" \
    --dict ./data/g2p.freq \
    --mode fuzzy \
    --max-edit-distance 5 \
    --num-suggestions 10

"""

import argparse
import sys
import os
import shutil
from typing import Optional

import torch
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    AutoModelForSeq2SeqLM,
    pipeline,
)

# sentence-transformers for sentence similarity
try:
    from sentence_transformers import SentenceTransformer, util as st_util
except Exception:
    SentenceTransformer = None
    st_util = None

# SymSpell for spell correction (optional)
try:
    from symspellpy.symspellpy import SymSpell, Verbosity
except Exception:
    SymSpell = None
    Verbosity = None

DEFAULTS = {
    "gen_model": "jojo-ai-mst/MyanmarGPT",
    "sum_model": "csebuetnlp/mT5_multilingual_XLSum",
    "trans_model": "facebook/nllb-200-distilled-600M",
    "ner_model": "Davlan/xlm-roberta-base-ner-hrl",
    "sim_model": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
}

## "ner_model": "jplu/tf-xlm-r-ner-40-lang",

def check_tmp_space(min_free_mb: int = 100):
    """Check /tmp free space. If low, warn and redirect TMPDIR."""
    try:
        stat = shutil.disk_usage("/tmp")
        free_mb = stat.free // (1024 * 1024)
        if free_mb < min_free_mb:
            sys.stderr.write(
                f"[WARNING] /tmp has only {free_mb} MB free. Models may fail to load.\n"
            )
            fallback_tmp = os.path.abspath("./tmp")
            os.makedirs(fallback_tmp, exist_ok=True)
            os.environ["TMPDIR"] = fallback_tmp
            sys.stderr.write(f"[INFO] Using TMPDIR={fallback_tmp} instead.\n")
    except Exception as e:
        sys.stderr.write(f"[WARNING] Could not check /tmp space: {e}\n")


def pick_device(device_arg: Optional[int]) -> int:
    if device_arg is None:
        return 0 if torch.cuda.is_available() else -1
    try:
        return int(device_arg)
    except Exception:
        return 0 if torch.cuda.is_available() else -1


def read_text_from_args(args):
    if getattr(args, "text", None):
        return args.text
    if getattr(args, "text_file", None):
        with open(args.text_file, "r", encoding="utf-8") as fh:
            return fh.read()
    print("Error: provide --text or --text-file", file=sys.stderr)
    sys.exit(1)

def do_generate(args):
    text = read_text_from_args(args)
    model_name = args.model or DEFAULTS["gen_model"]
    device = pick_device(args.device)
    print(f"Loading generation model: {model_name} (device={device})")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    load_kwargs = {}
    if device >= 0 and torch.cuda.is_available():
        load_kwargs["torch_dtype"] = torch.float16
    model = AutoModelForCausalLM.from_pretrained(model_name, **load_kwargs)
    if device >= 0 and torch.cuda.is_available():
        model = model.to(f"cuda:{device}")
    gen = pipeline("text-generation", model=model, tokenizer=tokenizer, device=device)
    out = gen(
        text,
        max_length=args.max_length,
        do_sample=args.do_sample,
        temperature=args.temperature,
        top_k=args.top_k,
        top_p=args.top_p,
        num_return_sequences=args.num_return_sequences,
        pad_token_id=tokenizer.eos_token_id if hasattr(tokenizer, "eos_token_id") else None,
    )
    print("\n--- GENERATION ---\n")
    if isinstance(out, list):
        for i, o in enumerate(out):
            txt = o.get("generated_text") if isinstance(o, dict) else str(o)
            print(f"--- sequence {i+1} ---\n{txt}\n")
    else:
        print(out)


def do_summarize(args):
    text = read_text_from_args(args)
    model_name = args.model or DEFAULTS["sum_model"]
    device = pick_device(args.device)
    print(f"Loading summarization model: {model_name} (device={device})")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    load_kwargs = {}
    if device >= 0 and torch.cuda.is_available():
        load_kwargs["torch_dtype"] = torch.float16
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name, **load_kwargs)
    if device >= 0 and torch.cuda.is_available():
        model = model.to(f"cuda:{device}")
    summarizer = pipeline("summarization", model=model, tokenizer=tokenizer, device=device)
    summary = summarizer(text, max_length=args.max_length, min_length=args.min_length, num_beams=args.num_beams)
    print("\n--- SUMMARY ---\n")
    if isinstance(summary, list):
        print(summary[0]["summary_text"]) if isinstance(summary[0], dict) else print(summary)
    else:
        print(summary)


def do_translate(args):
    text = read_text_from_args(args)
    model_name = args.model or DEFAULTS["trans_model"]
    device = pick_device(args.device)
    src_lang = args.src or "eng_Latn"
    tgt_lang = args.tgt or "mya_Mymr"
    print(f"Loading translation model: {model_name} (device={device}) src={src_lang} tgt={tgt_lang}")
    translator = pipeline("translation", model=model_name, device=device, src_lang=src_lang, tgt_lang=tgt_lang)
    out = translator(text)
    print("\n--- TRANSLATION ---\n")
    if isinstance(out, list):
        print(out[0].get("translation_text") if isinstance(out[0], dict) else out)
    else:
        print(out)


def do_ner(args):
    text = read_text_from_args(args)
    model_name = args.model or DEFAULTS["ner_model"]
    device = pick_device(args.device)
    print(f"Loading NER model: {model_name} (device={device})")
    
    nlp = pipeline(
        "ner",
        model=model_name,
        aggregation_strategy="simple",   # ✅ replaces grouped_entities=True
        device=device,
    )
    
    out = nlp(text)
    print("\n--- NAMED ENTITIES ---\n")
    for ent in out:
        print(ent)


def do_sim(args):
    if SentenceTransformer is None:
        print("SentenceTransformer not installed. Please install sentence-transformers.", file=sys.stderr)
        sys.exit(1)
    model_name = args.model or DEFAULTS["sim_model"]
    model = SentenceTransformer(model_name)
    emb1 = model.encode(args.text1, convert_to_tensor=True)
    emb2 = model.encode(args.text2, convert_to_tensor=True)
    score = st_util.pytorch_cos_sim(emb1, emb2).item()
    print("\n--- SIMILARITY ---\n")
    print(f"Score: {score:.4f}")


def do_spellcheck(args):
    if SymSpell is None:
        print("SymSpell not installed. Please install symspellpy.", file=sys.stderr)
        sys.exit(1)
    #sym = SymSpell(max_dictionary_edit_distance=2, prefix_length=7)
    sym = SymSpell(max_dictionary_edit_distance=args.max_edit_distance, prefix_length=7)

    if not sym.load_dictionary(args.dict, term_index=0, count_index=1):
        print(f"Failed to load dictionary {args.dict}", file=sys.stderr)
        sys.exit(1)
    #suggestions = sym.lookup(args.word, Verbosity.CLOSEST, max_edit_distance=2, transfer_casing=True)
    suggestions = sym.lookup(
        word,
        Verbosity.CLOSEST,
        max_edit_distance=args.max_edit_distance,
    )

    print("\n--- SPELLCHECK ---\n")
    if suggestions:
        for sug in suggestions[: args.num_suggestions]:
            print(f"{word} -> {sug.term} (distance={sug.distance}, freq={sug.count})")
    else:
        print("No suggestion.")


def do_spellcheck(args):
    word = args.word.strip()
    dict_file = args.dict

    print("\n--- SPELLCHECK ---\n")

    if args.mode == "exact":
        # Exact dictionary lookup
        mapping = {}
        with open(dict_file, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) == 2:
                    wrong, correct = parts
                    mapping[wrong] = correct

        if word in mapping:
            print(f"{word} -> {mapping[word]}")
        else:
            print("No suggestion.")

    elif args.mode == "fuzzy":
        # Fuzzy lookup using SymSpell
        if SymSpell is None:
            print("SymSpell not installed. Please install symspellpy.", file=sys.stderr)
            return

        sym = SymSpell(max_dictionary_edit_distance=2, prefix_length=7)
        with open(dict_file, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) == 2:
                    wrong, correct = parts
                    # Add both wrong and correct words with frequency=1
                    sym.create_dictionary_entry(wrong, 1)
                    sym.create_dictionary_entry(correct, 1)

        suggestions = sym.lookup(word, Verbosity.CLOSEST, max_edit_distance=2)
        if suggestions:
            for sug in suggestions:
                print(f"{word} -> {sug.term} (distance={sug.distance}, freq={sug.count})")
        else:
            print("No suggestion.")


def main(argv=None):
    check_tmp_space()
    p = argparse.ArgumentParser(description="Myanmar NLP demo — generation / summarization / translation / ner / sim / spellcheck")
    p.add_argument("--device", type=int, default=None, help="Device index for GPU (e.g. 0). Omit or -1 for CPU. Defaults to GPU if available.")

    sub = p.add_subparsers(dest="command", required=True)

    # Generate
    sp = sub.add_parser("generate", help="Text generation (Myanmar GPT or similar)")
    sp.add_argument("--text", type=str, help="Input text string")
    sp.add_argument("--text-file", type=str, help="Path to text file")
    sp.add_argument("--model", type=str, help="HF model name")
    sp.add_argument("--max-length", type=int, default=200)
    sp.add_argument("--do-sample", action="store_true")
    sp.add_argument("--temperature", type=float, default=0.9)
    sp.add_argument("--top-k", type=int, default=50)
    sp.add_argument("--top-p", type=float, default=0.95)
    sp.add_argument("--num-return-sequences", type=int, default=1)
    sp.set_defaults(func=do_generate)

    # Summarize
    sp = sub.add_parser("summarize", help="Summarization task")
    sp.add_argument("--text", type=str)
    sp.add_argument("--text-file", type=str)
    sp.add_argument("--model", type=str)
    sp.add_argument("--max-length", type=int, default=100)
    sp.add_argument("--min-length", type=int, default=10)
    sp.add_argument("--num-beams", type=int, default=4)
    sp.set_defaults(func=do_summarize)

    # Translate
    sp = sub.add_parser("translate", help="Machine translation task")
    sp.add_argument("--text", type=str)
    sp.add_argument("--text-file", type=str)
    sp.add_argument("--model", type=str)
    sp.add_argument("--src", type=str, default="eng_Latn")
    sp.add_argument("--tgt", type=str, default="mya_Mymr")
    sp.set_defaults(func=do_translate)

    # NER
    sp = sub.add_parser("ner", help="Named entity recognition")
    sp.add_argument("--text", type=str)
    sp.add_argument("--text-file", type=str)
    sp.add_argument("--model", type=str)
    sp.set_defaults(func=do_ner)

    # Similarity
    sp = sub.add_parser("sim", help="Sentence similarity (paraphrase check)")
    sp.add_argument("--text1", type=str, required=True)
    sp.add_argument("--text2", type=str, required=True)
    sp.add_argument("--model", type=str)
    sp.set_defaults(func=do_sim)

    # Spellcheck
    sp = sub.add_parser("spellcheck", help="Spell checking with SymSpell dictionary")
    sp.add_argument("--word", type=str, required=True)
    sp.add_argument("--dict", type=str, required=True, help="Dictionary file with 'word frequency'")
    sp.add_argument(
        "--mode",
        type=str,
        choices=["exact", "fuzzy"],
        default="exact",
        help="Use 'exact' for simple dictionary lookup or 'fuzzy' for SymSpell edit-distance suggestions",
    )
    sp.add_argument(
        "--max-edit-distance",
        type=int,
        default=2,
        help="Maximum edit distance for fuzzy matching (default=2)",
    )
    sp.add_argument(
        "--num-suggestions",
        type=int,
        default=5,
        help="Maximum number of suggestions to return (default=5)",
    )
    sp.set_defaults(func=do_spellcheck)

    args = p.parse_args(argv)
    args.func(args)

if __name__ == "__main__":
    main()

