# Data Acquisition Report

Group-3's speech dataset for the Burmese ASR Mini Project was self-recorded
by the team using Dr. Ye Kyaw Thu's Speech Training Recorder.

Recording ZIP Download: [Google Drive - Burmese ASR Recordings] - https://drive.google.com/drive/folders/1J3-MFgWBMdnF56o1VJWeXBtkXcx1mDlc?usp=drive_link

7 speakers took part in recording, each reading the same 150-prompt script
5 times:

```
Male:   5
Female: 2
```

In total, 5,256 recorded utterances were collected.

---

## Recording Format & Directory Management

Each speaker's recordings are kept in their own folder. `wav.scp` maps each
utterance id to its audio file path, and `text`/`utt2spk` give the
transcription and speaker id, in the standard Kaldi data-preparation format.

```
recordings/
├── AungKoOo/
├── HtunAungKyaw/
├── PhyoMyatOo/
├── SuYeHlaing/
├── TheinKyawLwin/
├── aintkyiphyushin/
└── aungchannyein/
```

Audio was also loudness-normalised and silence-trimmed before training (see
`recordings_norm/` and `recordings_trim/` in the shared recordings archive).

---

## Train/Test Split

```
Training Set: 5 speakers (71.4%)
Testing Set:  2 speakers (28.6%)
```

```
Gender Distribution

Training Set: 5 speakers - Male: 4, Female: 1
Testing Set:  2 speakers - Male: 1, Female: 1
```

The 2 speakers in the testing set are excluded entirely from training, so
model performance is measured on voices it has never heard before.

---

## Recording Tools

We used Dr. Ye Kyaw Thu's Speech Training Recorder, which writes Kaldi-ready
`wav.scp`/`text`/`utt2spk` files at recording time.

More details: [Recording Tool](https://github.com/ye-kyaw-thu/AIE-F-B2/tree/main/assignment/assignment-4/recording_tool)

---

## References

- https://github.com/ye-kyaw-thu/AIE-F-B2/tree/main/assignment/assignment-4/recording_tool
