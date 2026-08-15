# Assignment-2: POLAR Burmese Polarization Dataset

## Overview
This repository contains a 600-sentence Burmese polarization dataset constructed following the SemEval POLAR schema.

## Deliverables Summary
- `process_pipeline.py`: Python automation script for cleaning, ID hashing, and dataset generation.
- `config.yaml`: Potato Annotation Tool configuration file.
- `data.json`: Formatted input file containing 600 Burmese sentences for Potato UI.
- `final_dataset_output.csv`: Complete annotated CSV dataset following the POLAR 6-dimension schema.

## Dataset Specifications
- **Total Count:** 600 distinct word-segmented sentences
- **ID Format:** Unique MD5 hash prefixed with `mya_`
- **Output Schema:** `[mya_id, text, L1, L2, L3, L4, L5, L6, keywords]`