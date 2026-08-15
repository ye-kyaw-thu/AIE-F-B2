# Assignment-2: Alternative Open Datasets for POLAR Benchmark

## 1. Overview
This deliverable integrates Burmese text from two major open-source NLP corpora:
1. **UCSM Hate Speech & Sentiment Corpus**: Social media comments categorized for hostility and toxicity.
2. **myPOS Corpus**: Standardized Burmese literature and news texts for clean baseline entries.

---

## 2. Data Sources & Breakdown

| Source | Category | Count | Primary Focus |
| :--- | :--- | :---: | :--- |
| **UCSM Sentiment Corpus** | Social Media & Online News | 300 | Toxicity, Insults, Hate Speech |
| **myPOS Corpus** | Literature & Press | 300 | Neutral Baseline Texts |
| **Total** | | **600** | **Fully Segmented & Annotated** |

---

## 3. CSV Format Output

`[mya_id], [word_segmented_text], [L1], [L2], [L3], [L4], [L5], [L6], [keywords]`

### Sample Output:
```csv
mya_4e9b1120f28e23ab1190bc2a1290ff21,ဒီလို မျိုး မ ဟုတ် မ မှန် တာ တွေ လျှောက် ပြော နေ တာ ရှက် ဖို့ ကောင်း တယ်,1,1,0,0,0,0,ရှက် ဖို့ ကောင်း တယ်
mya_5a1098bc1922a10e82c1827a192801ef,မြန်မာ နိုင်ငံ ၏ ပညာရေး စနစ် ပြုပြင် ပြောင်းလဲ ရေး ဆိုင်ရာ ဆွေးနွေးပွဲ ကို ကျင်းပ ခဲ့သည်။,0,0,0,0,0,0,NULL
# AIE-F-B2
AI Engineering (Fundamental) Class, Batch-2
