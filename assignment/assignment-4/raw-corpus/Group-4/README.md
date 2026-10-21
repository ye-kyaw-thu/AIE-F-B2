# Data Acquisition Report

ကျနော်တို့ Group-4 အနေနဲ့ Burmese ASR Mini Project အတွက် လိုအပ်သော Speech Dataset ကို ကိုယ်တိုင်အသံသွင်း၍ စုဆောင်းခဲ့ပါသည်။ 

📦 Recording ZIP Download: [Google Drive – Burmese ASR Recordings
](https://drive.google.com/file/d/1S-BdQPPfQaHjYyRmpiWZNitfY5xi7pRQ/view?usp=sharing
)

ပထမဦးဆုံး Recording Process တွင် စုစုပေါင်း Speaker 7 ဦး ပါဝင်ခဲ့ပြီး၊ 

```
Male : 4 ယောက်
Female : 3 ယောက်
```

ပါဝင်ခဲ့ပါတယ်။

ပါဝင်သူတစ်ဦးချင်းစီထံမှ အသံသွင်းယူခဲ့ပြီး၊ စုစုပေါင်း WAV audio recordings 30 ခု ရရှိခဲ့ပါတယ်။

ထို recordings များမှတစ်ဆင့် စုစုပေါင်း 5,250 recorded sentences/utterances အထိ စုဆောင်းရရှိနိုင်ခဲ့ပါတယ်။

---

## Recording Format & Directory Management

အသံဖိုင်များကို speaker တစ်ဦးချင်းစီအလိုက် သီးခြား folder များအတွင်း စနစ်တကျသိမ်းဆည်းထားပြီး၊ Kaldi ASR training အတွက် ```wav.scp file``` တွင် ```audio file``` တစ်ခုချင်းစီ၏     ```identifier``` နှင့် ```file path``` များကို သတ်မှတ်ထားပါတယ်။ 

ထို့အပြင် recording data များကို speaker information နှင့် corresponding transcription များနှင့် ချိတ်ဆက်နိုင်ရန် Kaldi data preparation format နှင့် ကိုက်ညီအောင် ပြင်ဆင်ထားပါတယ်။

audio file များ၏ original directory နှင့် file path များမှာ မတူညီမှုများ ရှိခဲ့ပါသည်။ ထို့ကြောင့် Kaldi environment အတွင်း data များကို စနစ်တကျနှင့် အလွယ်တကူ အသုံးပြုနိုင်ရန် speaker တစ်ဦးချင်းစီ၏ recording များကို Ubuntu environment အတွင်းရှိ common recordings directory အောက်တွင် speaker အလိုက် folder များခွဲ၍ ပြန်လည်စုစည်းခဲ့ပါတယ်။

ဥပမာအားဖြင့် recording directory ကို အောက်ပါပုံစံဖြင့် စနစ်တကျ ဖွဲ့စည်းထားပါတယ်။
```
recordings/
├── AungKhantMyat/
├── HtooEaindraTin/
├── MyintThuSoe/
├── SoeThandarTint/
├── ThantSinTun/
├── ThidaAye/
└── WaiYanHtetAung/
```

နောက်တစ်ဆင့်တွင် training နှင့် testing data များအဖြစ် ခွဲခြား၍ Burmese ASR model တည်ဆောက်ရန် ဆက်လက်အသုံးပြုသွားပါမယ်။

---

## Train/Test Split

Dataset ကို **Training Set** နှင့် **Testing Set** ဟူ၍ ခွဲခြားအသုံးပြုခဲ့ပါတယ်။ 
  
```
Training Set: 5 ဦး (71.4%)
Testing Set: 2 ဦး (28.6%)
```

```
# Gender Distribution

Training Set: Speaker 5 ဦး — Male: 3, Female: 2
Testing Set: Speaker 2 ဦး — Male: 1, Female: 1
```

Testing Set တွင် ပါဝင်သော Speaker များကို Training Set တွင် မပါဝင်စေရန် သီးခြားခွဲထားပါတယ်။

ထိုကြောင့် Training ပြုလုပ်စဉ် မတွေ့ဖူးသေးသော Speaker များ၏ အသံများအပေါ် ASR Model ရဲ့ Performace ကို စမ်းသပ်နိုင်မည်ဖြစ်ပါတယ်။

---

## Recording Tools
Recording tool အနေနဲ့ ဆရာ Dr. Ye Kyaw Thu ရဲ့ Speech Training Recorder ကို အသုံးပြုထားပါတယ်။ Tool ရဲ့ အားသာချက်ကတော့ Kaldi နဲ့ ASR model တည်ဆောက်ဖို့ အတွက် လိုအပ်တဲ့ data format တွေကို recording ယူတဲ့အချိန်မှာပါ တစ်ခါတည်း ထုတ်ပေးတာဖြစ်ပါတယ်။ ဒါကြောင့် အချို့ preprocessing step တွေကို ပိုပြီး မြန်မြန်ဆန်ဆန် ပြုလုပ်လာနိုင်ပါတယ်။

More Details: [Recording Tool](https://github.com/ye-kyaw-thu/AIE-F-B2/tree/main/assignment/assignment-4/recording_tool)

---

## References

- https://github.com/ye-kyaw-thu/AIE-F-B2/tree/main/assignment/assignment-4/recording_tool

- https://arxiv.org/abs/2506.07149









