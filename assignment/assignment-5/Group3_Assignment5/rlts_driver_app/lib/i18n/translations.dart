/// Same simplified approach as rlts-myanmar/src/lib/i18n/translations.ts: a
/// high-visibility subset, plain key->string maps rather than ARB/gen-l10n codegen (the
/// approach OpenIMIS's voucher_enquire_flutter uses via flutter_localizations +
/// AppLocalizations). ARB codegen is the more "correct" Flutter-idiomatic approach and
/// is the natural upgrade if this app grows past a prototype; skipped here to avoid
/// adding a build step this close to the deadline. Myanmar strings are AI-translated
/// and unreviewed by a native speaker — same caveat as the web app.
library;

enum Lang { en, mm }

final Map<Lang, Map<String, String>> kTranslations = {
  Lang.en: {
    "appTitle": "RLTS-MM Driver",
    "signIn": "Sign In",
    "username": "Username",
    "password": "Password",
    "logout": "Log out",
    "networkStatus": "Network Status",
    "deviceReports": "Device reports",
    "checkpointActions": "One-Tap Checkpoint Actions",
    "arrived": "Arrived at Checkpoint",
    "cleared": "Inspection Passed",
    "delay": "Report Delay / Danger",
    "delivered": "Delivered / Handed Over",
    "locationNote": "Simulated position from route progress — not real GPS",
    "capturePhoto": "Capture waybill / inspection photo",
    "photoAttached": "Photo attached",
    "syncNow": "Sync Now",
    "syncRef": "Sync Ref",
    "localQueue": "Local Queue (this device)",
    "nothingQueued": "Nothing queued yet.",
    "noShipmentAssigned": "No shipment assigned to this driver yet.",
    "cargoValue": "Cargo Value",
    "online": "ONLINE",
    "offline": "OFFLINE BLACKOUT",
  },
  Lang.mm: {
    "appTitle": "RLTS-MM ယာဉ်မောင်း",
    "signIn": "လော့ဂ်အင်ဝင်ရန်",
    "username": "အသုံးပြုသူအမည်",
    "password": "စကားဝှက်",
    "logout": "ထွက်ရန်",
    "networkStatus": "ကွန်ရက်အခြေအနေ",
    "deviceReports": "စက်ပစ္စည်းမှ တွေ့ရှိချက်",
    "checkpointActions": "စစ်ဆေးရေးစခန်း လုပ်ဆောင်ချက်များ",
    "arrived": "စစ်ဆေးရေးစခန်းသို့ ရောက်ရှိပြီ",
    "cleared": "စစ်ဆေးမှု ပြီးဆုံးပြီ",
    "delay": "နှောင့်နှေး/အန္တရာယ် အစီရင်ခံရန်",
    "delivered": "ပို့ဆောင်ပြီး / လွှဲပြောင်းပြီး",
    "locationNote": "လမ်းကြောင်းတိုးတက်မှုမှ အတုအယောင် တည်နေရာ — တကယ့် GPS မဟုတ်ပါ",
    "capturePhoto": "ဓာတ်ပုံရိုက်ရန်",
    "photoAttached": "ဓာတ်ပုံတွဲပြီး",
    "syncNow": "ယခုပင် စင့်ခ်လုပ်ရန်",
    "syncRef": "စင့်ခ် ကိုးကားနံပါတ်",
    "localQueue": "စက်တွင်း စာရင်း",
    "nothingQueued": "မည်သည့်စာရင်းမျှ မရှိသေးပါ။",
    "noShipmentAssigned": "ဤယာဉ်မောင်းအတွက် ကုန်စည်တာဝန် မသတ်မှတ်ရသေးပါ။",
    "cargoValue": "ကုန်ပစ္စည်းတန်ဖိုး",
    "online": "အွန်လိုင်း",
    "offline": "အော့ဖ်လိုင်း",
  },
};

String t(Lang lang, String key) => kTranslations[lang]?[key] ?? kTranslations[Lang.en]![key] ?? key;
