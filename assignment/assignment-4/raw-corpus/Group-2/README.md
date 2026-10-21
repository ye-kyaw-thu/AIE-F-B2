# Data Acquisition Report

Group-2's speech dataset for the Burmese ASR Mini Project was self-recorded
by the team using Dr. Ye Kyaw Thu's Speech Training Recorder.

7 speakers took part in recording, each reading the same 150-prompt script
5 times (where available):

```
Male:   4  (HanZawHtet, KhantHtay, KyawZayaNaing, YeLinTun)
Female: 3  (NawSayRiHtoo, YinMon, PunKhattgar)
```

Official held-out test pair (Assignment 4): **YeLinTun (M)** + **PunKhattgar (F)**.

In total, **5,162** utterances are listed across Kaldi splits
(train 2999 + dev 743 + test 1420).

---

## Recording Format & Directory Management

Each speaker's recordings are kept in their own folder under the team's
`raw-corpus/`. `wav.scp` maps each utterance id to its audio file path, and
`text` / `utt2spk` / `spk2utt` follow the standard Kaldi data-preparation format.

```
raw-corpus/ (local team archive)
├── HanZawHtet/
├── NawSayRiHtoo_Rec/
├── KhantHtay/
├── Kyaw-Zaya-Naing/
├── YinMon_REC/
├── YeLinTun/
└── PunKhattgar/
```

Audio WAV files are **not** uploaded here (size). Use the team recording archive /
local `raw-corpus/` and update paths in `wav.scp` as needed.

---

## Train / Dev / Test Split (speaker-held-out)

Per Assignment 4 guidance: split by **speakers**, with test = 1 male + 1 female.

```
Training Set: 4 speakers — HanZawHtet (M), NawSayRiHtoo (F), KhantHtay (M), KyawZayaNaing (M)
Dev Set:      1 speaker  — YinMon (F)
Testing Set:  2 speakers — YeLinTun (M) + PunKhattgar (F)
```

```
# Utterance counts
Train: 2999
Dev:    743
Test:  1420
```

Test speakers are excluded entirely from train/dev so evaluation is on unseen voices.

See also `split_plan.md` and `split_config.json`.

---

## Contents in this folder

```
Group-2/
├── README.md
├── split_plan.md
├── split_config.json
├── notebook/
│   ├── Assignment4_MiniASR_SHORT.ipynb
│   ├── Assignment4_Demo_Result_Audio_Picker.ipynb
│   ├── Assignment4_MiniASR.ipynb
│   └── README.md
├── train/   (text, utt2spk, wav.scp, spk2utt)
├── dev/
└── test/
```

---

## Recording Tools

Recording tool: Dr. Ye Kyaw Thu's Speech Training Recorder  
More Details: [Recording Tool](https://github.com/ye-kyaw-thu/AIE-F-B2/tree/main/assignment/assignment-4/recording_tool)

---

## References

- https://github.com/ye-kyaw-thu/AIE-F-B2/tree/main/assignment/assignment-4
