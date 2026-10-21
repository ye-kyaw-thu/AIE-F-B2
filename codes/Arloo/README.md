# 🥔 Arloo Annotation Tool

Polar ဒေတာ annotation လုပ်ဖို့အတွက် Arloo Annotation Tool ပါ။ ပထမပိုင်းမှာ Web UI ရော Python GUI ရော နှစ်မျိုးစလုံး ရဖို့ ရေးခဲ့ပေမဲ့ code လိုင်းအရေအတွက်က တစ်ထောင်ကျော်လာတာမို့ လက်ရှိ ဗားရှင်း 0.9 မှာ Web UI ကိုပဲ support လုပ်ထားပါတယ်။ Lightweight နဲ့ လွယ်လွယ်ကူကူ run လို့ပြီး corpus annotation အလုပ်ကို အမြန်ဆုံး စလုပ်နိုင်ဖို့ ဒီဇိုင်း လုပ်ထားပါတယ်။ Assignment-2 ပရောဂျက် အသေးလေးအတွက်တော့ အဆင်ပြေမယ်လို့ ထင်ပါတယ်။  

<p align="center">
<img src="https://github.com/ye-kyaw-thu/AIE-F-B2/blob/main/codes/Arloo/UI-fig/Arloo-Annotation-Tool-UI-Adding-New-Sentence.png" alt="UI of Arloo Annotation Tool" width="800">  
</p>

## Library Installation

Python library နှစ်ခုပဲ installation လုပ်ဖို့ လိုအပ်ပါတယ်။  

```
pip install flask
pip install pyyaml
```

## --help

ဘယ်လို run ရမလဲ ဆိုတာကို `--help` ခေါ်ကြည့်ပါ။  

```
PS C:\Users\yktnl\Downloads\aat> python .\arloo.py --help
usage: arloo.py [-h] {web,init} ...

🥔 Arloo Annotation Tool — Lightweight POLAR dataset annotator

positional arguments:
  {web,init}  Operation mode
    web       Run web interface (Flask)
    init      Create sample config and text files

options:
  -h, --help  show this help message and exit

Examples:
  python arloo.py init
  python arloo.py web --annotator "kyawkyaw" --input sample_texts.txt
  python arloo.py web --annotator "kyawkyaw" --input data.csv --port 8080
  python arloo.py web --annotator "kyawkyaw"  # Start empty, add sentences interactively

PS C:\Users\yktnl\Downloads\aat>
```

## Running Method-1: Initialization

ဒီနည်းကတော့ ပထမဆုံး Arloo Annotation Tool ကို run မယ်ဆိုရင် အသုံးပြုလို့ ရပါတယ်။ ကိုယ့်ဆီမှာ configuration file လည်း မပြင်ရသေးဘူး။ Text corpus လည်း မရှိသေးဘူးဆိုတဲ့ အခြေအနေပါ။ အောက်ပါအတိုင်း run လိုက်ရင် example configuration ဖိုင်နဲ့ example text corpus ဖိုင်ကို အော်တိုဆောက်ပေးသွားပါလိမ့်မယ်။  

```
PS C:\Users\yktnl\Downloads\aat> python .\arloo.py init
✅ Created: arloo_config.yaml
✅ Created: sample_texts.txt

📋 Next steps:
   1. Edit arloo_config.yaml to customize fields (optional)
   2. Add your texts to sample_texts.txt (one per line)
   3. Run: python arloo.py web --annotator "your-name" --input sample_texts.txt
   4. Open http://localhost:5000 in your browser

PS C:\Users\yktnl\Downloads\aat>
```

## arloo_config.yaml

အော်တို ဆောက်ပေးသွားတဲ့ configuration file ဖြစ်တဲ့ `arloo_config.yaml` ဖိုင်ကတော့ အောက်ပါအတိုင်းပါ။  

```yaml
# Arloo Annotation Tool Configuration
# ====================================
# Edit this file to add, remove, or modify annotation fields.
# Field types: auto_id, text, binary
# For text fields: set multiline: true for textarea, false for single-line
# For separator: use ||| to separate multiple values within a field
# For binary fields: optionally set group to organize them in the UI

project:
  name: "POLAR Myanmar Annotation"
  language: "mya"

# ID pattern uses {language}, {annotator}, {index} placeholders
id_pattern: "{language}_{annotator}_{index}"

fields:
  # --- Metadata Fields ---
  - name: id
    type: auto_id
    readonly: true
    description: "Auto-generated unique ID"

  - name: source
    type: text
    multiline: true
    separator: "|||"
    description: "URL or source of the text. Use ||| to separate multiple sources."
    placeholder: "https://example.com/article|||Article title"

  - name: text
    type: text
    multiline: true
    description: "The main text to annotate"
    placeholder: "Enter or paste text here..."

  - name: key_phrase
    type: text
    multiline: true
    separator: "|||"
    description: "Key phrases. Use ||| to separate multiple phrases."
    placeholder: "key-phrase-1|||key-phrase-2|||key-phrase-3"

  # --- Sub-Task 1 & 2: Polarization Type ---
  - name: polarization
    type: binary
    group: "Sub-Task 1 & 2: Polarization Type"

  - name: political
    type: binary
    group: "Sub-Task 1 & 2: Polarization Type"

  - name: racial/ethnic
    type: binary
    group: "Sub-Task 1 & 2: Polarization Type"

  - name: religious
    type: binary
    group: "Sub-Task 1 & 2: Polarization Type"

  - name: gender/sexual
    type: binary
    group: "Sub-Task 1 & 2: Polarization Type"

  - name: other
    type: binary
    group: "Sub-Task 1 & 2: Polarization Type"

  # --- Sub-Task 3: Severity ---
  - name: stereotype
    type: binary
    group: "Sub-Task 3: Severity"

  - name: vilification
    type: binary
    group: "Sub-Task 3: Severity"

  - name: dehumanization
    type: binary
    group: "Sub-Task 3: Severity"

  - name: extreme_language
    type: binary
    group: "Sub-Task 3: Severity"

  - name: lack_of_empathy
    type: binary
    group: "Sub-Task 3: Severity"

  - name: invalidation
    type: binary
    group: "Sub-Task 3: Severity"

```

## sample_texts.txt

Text corpus ရဲ့ format က မြန်မာစာ တစ်ကြောင်းစီကို တစ်လိုင်းစီ ရိုက်ထည့်ထားတဲ့ ပုံစံပါ။ 
တကယ်လို့ annotation လုပ်မယ့် စာကြောင်းတွေကို အရင်စုပြီး လုပ်မယ်ဆိုရင် အခုလိုမျိုး text ဖိုင်ဆောက်ထားယုံပါပဲ။  

```
အော် သူ တစ် ယောက် တည်း ဒုက္ခ ပင်လယ်ဝေ နေ တာ နေ မယ် နိုင်ငံရေး က ငါ နဲ့ မ ဆိုင် ဘူး တဲ့ ဘယ်လိုဦးနှောက် နှလုံးသား နဲ့ များ ရှင်သန် ရပ်တည် နေ တယ် မ သိ ။
သူများ ကို မ ပြင် ခင် ကိုယ့် ဟာ ကို လည်း အရင် ပြင် ကြ ဦး 😞
မ ခံစား ရ ပါ စေ နဲ့ လည်း ပြော သေး တယ် ကံ တူ အကျိုး ပေး ပါ စေ တဲ့ ဘာ လား ဟ 🥲
သူ တကယ် ခံစား ရ တာ ပဲ နော်
မြန်မာ့ ယဉ်ကျေး မှု ဖျက် တဲ့ လူစား တွေ အခြား နည်း နဲ့ ပိုက်ဆံ ရှာ ပါ လား
မျိုးရိုး မ ကောင်း တာ ပြင် လို့ ကို မ ရ ဘူး
```

## Running Method-2: Web GUI and Plain Text File

```
python .\arloo.py web --annotator "YeKyawThu" --input .\sample_texts.txt
```

## Running Method-3: Web GUI and CSV Corpus

```
python arloo.py web --annotator "YeKyawThu" --input data.csv --port 8080
```

## Running Method-4: Web GUI and Add Sentences Interactively

```
python arloo.py web --annotator "YeKyawThu"
```

## Example Output Files

"Save As" button ကိုနှိပ်ပြီး "CSV" သို့မဟုတ် "TSV" သို့မဟုတ် "JSON" ဖိုင် အဖြစ် နာမည်ပေးပြီး သိမ်းဆည်းလို့ ရပါတယ်။  
CSV ဖိုင်ကတော့ အောက်ပါအတိုင်းပါ။  

### CSV File

```
id,source,text,key_phrase,polarization,political,racial/ethnic,religious,gender/sexual,other,stereotype,vilification,dehumanization,extreme_language,lack_of_empathy,invalidation
mya_yekyawthu_1,https://www.bbc.com/burmese/articles/c1w145qj9jdo|||ဘယ်လိုဦးနှောက် ဆောင်းပါး,အော် သူ တစ် ယောက် တည်း ဒုက္ခ ပင်လယ်ဝေ နေ တာ နေ မယ် နိုင်ငံရေး က ငါ နဲ့ မ ဆိုင် ဘူး တဲ့ ဘယ်လိုဦးနှောက် နှလုံးသား နဲ့ များ ရှင်သန် ရပ်တည် နေ တယ် မ သိ ။,ဒုက္ခ ပင်လယ်ဝေ|||ဘယ်လိုဦးနှောက်,1,1,0,0,0,0,0,0,0,1,0,0
mya_yekyawthu_2,တက်ကျမ်း အောင်သင်း,သူများ ကို မ ပြင် ခင် ကိုယ့် ဟာ ကို လည်း အရင် ပြင် ကြ ဦး 😞,,0,0,0,0,0,0,0,0,0,0,0,0
mya_yekyawthu_3,အရူးလွယ်အိပ် မှော်ဘီဆရာသိန်း,မ ခံစား ရ ပါ စေ နဲ့ လည်း ပြော သေး တယ် ကံ တူ အကျိုး ပေး ပါ စေ တဲ့ ဘာ လား ဟ 🥲,,0,0,0,0,0,0,0,0,0,0,0,0
mya_yekyawthu_4,,သူ တကယ် ခံစား ရ တာ ပဲ နော်,,0,0,0,0,0,0,0,0,0,0,0,0
mya_yekyawthu_5,Facebook|||အတင်းအဖျင်းကြိုက်သူများ အကောင့်,မြန်မာ့ ယဉ်ကျေး မှု ဖျက် တဲ့ လူစား တွေ အခြား နည်း နဲ့ ပိုက်ဆံ ရှာ ပါ လား,,1,0,1,0,0,0,1,0,0,0,0,0
mya_yekyawthu_6,mya_00ddacad18225126c693206cf275f4a1,မျိုးရိုး မ ကောင်း တာ ပြင် လို့ ကို မ ရ ဘူး,မျိုးရိုး မ ကောင်း,1,0,1,0,0,0,1,0,0,0,0,0
```

### TSV File

Tab key နဲ့ ခြားထားတဲ့ ဖိုင်ပုံစံ (TSV) ဖိုင်ကတော့ အောက်ပါ ပုံစံမျိုးပါ။  

```
id	source	text	key_phrase	polarization	political	racial/ethnic	religious	gender/sexual	other	stereotype	vilification	dehumanization	extreme_language	lack_of_empathy	invalidation
mya_yekyawthu_1	https://www.bbc.com/burmese/articles/c1w145qj9jdo|||ဘယ်လိုဦးနှောက် ဆောင်းပါး	အော် သူ တစ် ယောက် တည်း ဒုက္ခ ပင်လယ်ဝေ နေ တာ နေ မယ် နိုင်ငံရေး က ငါ နဲ့ မ ဆိုင် ဘူး တဲ့ ဘယ်လိုဦးနှောက် နှလုံးသား နဲ့ များ ရှင်သန် ရပ်တည် နေ တယ် မ သိ ။	ဒုက္ခ ပင်လယ်ဝေ|||ဘယ်လိုဦးနှောက်	1	1	0	0	0	0	0	0	0	1	0	0
mya_yekyawthu_2	တက်ကျမ်း အောင်သင်း	သူများ ကို မ ပြင် ခင် ကိုယ့် ဟာ ကို လည်း အရင် ပြင် ကြ ဦး 😞		0	0	0	0	0	0	0	0	0	0	0	0
mya_yekyawthu_3	အရူးလွယ်အိပ် မှော်ဘီဆရာသိန်း	မ ခံစား ရ ပါ စေ နဲ့ လည်း ပြော သေး တယ် ကံ တူ အကျိုး ပေး ပါ စေ တဲ့ ဘာ လား ဟ 🥲		0	0	0	0	0	0	0	0	0	0	0	0
mya_yekyawthu_4		သူ တကယ် ခံစား ရ တာ ပဲ နော်		0	0	0	0	0	0	0	0	0	0	0	0
mya_yekyawthu_5	Facebook|||အတင်းအဖျင်းကြိုက်သူများ အကောင့်	မြန်မာ့ ယဉ်ကျေး မှု ဖျက် တဲ့ လူစား တွေ အခြား နည်း နဲ့ ပိုက်ဆံ ရှာ ပါ လား		1	0	1	0	0	0	1	0	0	0	0	0
mya_yekyawthu_6	mya_00ddacad18225126c693206cf275f4a1	မျိုးရိုး မ ကောင်း တာ ပြင် လို့ ကို မ ရ ဘူး	မျိုးရိုး မ ကောင်း	1	0	1	0	0	0	1	0	0	0	0	0

```

### JSON File

JSON ဖိုင် ဥပမာ ကတော့ အောက်ပါအတိုင်းပါ။  

```json
[
  {
    "id": "mya_yekyawthu_1",
    "source": "https://www.bbc.com/burmese/articles/c1w145qj9jdo|||ဘယ်လိုဦးနှောက် ဆောင်းပါး",
    "text": "အော် သူ တစ် ယောက် တည်း ဒုက္ခ ပင်လယ်ဝေ နေ တာ နေ မယ် နိုင်ငံရေး က ငါ နဲ့ မ ဆိုင် ဘူး တဲ့ ဘယ်လိုဦးနှောက် နှလုံးသား နဲ့ များ ရှင်သန် ရပ်တည် နေ တယ် မ သိ ။",
    "key_phrase": "ဒုက္ခ ပင်လယ်ဝေ|||ဘယ်လိုဦးနှောက်",
    "polarization": "1",
    "political": "1",
    "racial/ethnic": "0",
    "religious": "0",
    "gender/sexual": "0",
    "other": "0",
    "stereotype": "0",
    "vilification": "0",
    "dehumanization": "0",
    "extreme_language": "1",
    "lack_of_empathy": "0",
    "invalidation": "0"
  },
  {
    "id": "mya_yekyawthu_2",
    "source": "တက်ကျမ်း အောင်သင်း",
    "text": "သူများ ကို မ ပြင် ခင် ကိုယ့် ဟာ ကို လည်း အရင် ပြင် ကြ ဦး 😞",
    "key_phrase": "",
    "polarization": "0",
    "political": "0",
    "racial/ethnic": "0",
    "religious": "0",
    "gender/sexual": "0",
    "other": "0",
    "stereotype": "0",
    "vilification": "0",
    "dehumanization": "0",
    "extreme_language": "0",
    "lack_of_empathy": "0",
    "invalidation": "0"
  },
  {
    "id": "mya_yekyawthu_3",
    "source": "အရူးလွယ်အိပ် မှော်ဘီဆရာသိန်း",
    "text": "မ ခံစား ရ ပါ စေ နဲ့ လည်း ပြော သေး တယ် ကံ တူ အကျိုး ပေး ပါ စေ တဲ့ ဘာ လား ဟ 🥲",
    "key_phrase": "",
    "polarization": "0",
    "political": "0",
    "racial/ethnic": "0",
    "religious": "0",
    "gender/sexual": "0",
    "other": "0",
    "stereotype": "0",
    "vilification": "0",
    "dehumanization": "0",
    "extreme_language": "0",
    "lack_of_empathy": "0",
    "invalidation": "0"
  },
  {
    "id": "mya_yekyawthu_4",
    "source": "",
    "text": "သူ တကယ် ခံစား ရ တာ ပဲ နော်",
    "key_phrase": "",
    "polarization": "0",
    "political": "0",
    "racial/ethnic": "0",
    "religious": "0",
    "gender/sexual": "0",
    "other": "0",
    "stereotype": "0",
    "vilification": "0",
    "dehumanization": "0",
    "extreme_language": "0",
    "lack_of_empathy": "0",
    "invalidation": "0"
  },
  {
    "id": "mya_yekyawthu_5",
    "source": "Facebook|||အတင်းအဖျင်းကြိုက်သူများ အကောင့်",
    "text": "မြန်မာ့ ယဉ်ကျေး မှု ဖျက် တဲ့ လူစား တွေ အခြား နည်း နဲ့ ပိုက်ဆံ ရှာ ပါ လား",
    "key_phrase": "",
    "polarization": "1",
    "political": "0",
    "racial/ethnic": "1",
    "religious": "0",
    "gender/sexual": "0",
    "other": "0",
    "stereotype": "1",
    "vilification": "0",
    "dehumanization": "0",
    "extreme_language": "0",
    "lack_of_empathy": "0",
    "invalidation": "0"
  },
  {
    "id": "mya_yekyawthu_6",
    "source": "mya_00ddacad18225126c693206cf275f4a1",
    "text": "မျိုးရိုး မ ကောင်း တာ ပြင် လို့ ကို မ ရ ဘူး",
    "key_phrase": "မျိုးရိုး မ ကောင်း",
    "polarization": "1",
    "political": "0",
    "racial/ethnic": "1",
    "religious": "0",
    "gender/sexual": "0",
    "other": "0",
    "stereotype": "1",
    "vilification": "0",
    "dehumanization": "0",
    "extreme_language": "0",
    "lack_of_empathy": "0",
    "invalidation": "0"
  }
]
```


